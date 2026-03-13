import { NextRequest } from 'next/server'
import { blingService } from '@/lib/bling/bling-service'
import { parseSku } from '@/lib/bling/sku-parser'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'
import { StorageService } from '@/lib/services/storage-service'

export interface SyncBlingResult {
  criadas: number
  atualizadas: number
  semModelo: number
  semImagem: number
  imagensBaixadas: number
  erros: string[]
}

export interface SyncBlingProgress {
  type: 'progress'
  atual: number
  produto: string
  pagina: number
}

export type SyncBlingEvent =
  | SyncBlingProgress
  | (SyncBlingResult & { type: 'done' })

// ── helpers ───────────────────────────────────────────────────────────────────

async function downloadToSupabase(
  remoteUrl: string,
  modeloCodigo: string,
  corCodigo: string,
): Promise<string | null> {
  const ext = remoteUrl.match(/\.(jpe?g|png|webp)/i)?.[1] ?? 'jpg'
  const fileName = `${modeloCodigo}-${corCodigo}.${ext}`
  return StorageService.uploadFromUrl(remoteUrl, fileName)
}

async function upsertVariante(
  modeloCodigo: string,
  corCodigo: string,
  imagemRemota: string | null,
  counters: SyncBlingResult,
): Promise<void> {
  const modelo = await prisma.modelo.findUnique({
    where: { codigo: modeloCodigo },
    select: { id: true },
  })

  if (!modelo) {
    counters.semModelo++
    return
  }

  const existente = await prisma.modeloVarianteCor.findUnique({
    where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo } },
    select: { id: true, imagemUrl: true },
  })

  const jaTemImagemLocal = existente?.imagemUrl?.includes('supabase')

  let imagemUrl: string | null = existente?.imagemUrl ?? null

  if (imagemRemota && !jaTemImagemLocal) {
    const publicUrl = await downloadToSupabase(imagemRemota, modeloCodigo, corCodigo)
    if (publicUrl) {
      imagemUrl = publicUrl
      counters.imagensBaixadas++
    } else {
      if (!existente?.imagemUrl) {
        counters.semImagem++
      }
    }
  } else if (!imagemRemota && !existente?.imagemUrl) {
    counters.semImagem++
  }

  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo } },
    update: imagemUrl && !jaTemImagemLocal ? { imagemUrl } : {},
    create: { modeloId: modelo.id, corCodigo, imagemUrl },
  })

  if (existente) {
    counters.atualizadas++
  } else {
    counters.criadas++
  }
}

// ── route ─────────────────────────────────────────────────────────────────────

// Passada única: processa produtos conforme percorre as páginas.
// Envia progresso como NDJSON (produto atual + página corrente).
export async function POST(request: NextRequest): Promise<Response> {
  const guard = requireAdmin(request)
  if (guard) return guard

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SyncBlingEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      }

      const counters: SyncBlingResult = {
        criadas: 0,
        atualizadas: 0,
        semModelo: 0,
        semImagem: 0,
        imagensBaixadas: 0,
        erros: [],
      }

      const processados = new Set<string>()

      try {
        let pagina = 1
        let hasMore = true
        let produtoAtual = 0

        while (hasMore) {
          const { data: produtos, hasMore: more } = await blingService.listProdutos(pagina)
          hasMore = more

          for (const produto of produtos) {
            produtoAtual++
            send({ type: 'progress', atual: produtoAtual, produto: produto.codigo, pagina })

            try {
              const parsed = await parseSku(produto.codigo)

              if (parsed.modelo && parsed.cor) {
                const chave = `${parsed.modelo}:${parsed.cor}`
                if (processados.has(chave)) continue
                processados.add(chave)

                const imagemUrl = produto.imagemThumbnail ?? null
                await upsertVariante(parsed.modelo, parsed.cor, imagemUrl, counters)
                continue
              }

              const detalhe = await blingService.getProduto(produto.id)
              if (!detalhe.variacoes?.length) continue

              for (const variacao of detalhe.variacoes) {
                if (!variacao.codigo) continue

                const parsedVar = await parseSku(variacao.codigo)
                if (!parsedVar.modelo || !parsedVar.cor) continue

                const chave = `${parsedVar.modelo}:${parsedVar.cor}`
                if (processados.has(chave)) continue
                processados.add(chave)

                const imagemUrl = variacao.imagens?.[0]?.link ?? null
                await upsertVariante(parsedVar.modelo, parsedVar.cor, imagemUrl, counters)
              }
            } catch (err) {
              counters.erros.push(
                `Produto ${produto.codigo}: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
              )
            }
          }

          pagina++
        }

        send({ type: 'done', ...counters })
      } catch (err) {
        counters.erros.push(err instanceof Error ? err.message : 'erro fatal')
        send({ type: 'done', ...counters })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}
