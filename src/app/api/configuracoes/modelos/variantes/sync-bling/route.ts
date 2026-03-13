import { NextRequest, NextResponse } from 'next/server'
import { blingService } from '@/lib/bling/bling-service'
import { parseSku } from '@/lib/bling/sku-parser'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'
import { StorageService } from '@/lib/services/storage-service'

export interface SyncBlingPageResult {
  pagina: number
  hasMore: boolean
  processados: number
  criadas: number
  atualizadas: number
  semModelo: number
  semImagem: number
  imagensBaixadas: number
  erros: string[]
}

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
  counters: Pick<SyncBlingPageResult, 'criadas' | 'atualizadas' | 'semModelo' | 'semImagem' | 'imagensBaixadas'>,
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

// POST /api/configuracoes/modelos/variantes/sync-bling?pagina=N
//
// Processa UMA página do Bling (20 produtos) por request.
// O frontend chama em loop: pagina=1, pagina=2, ... até hasMore=false.
// Cada request dura poucos segundos → sem timeout na Vercel.
//
// Query param "skip" (opcional): lista de chaves "modelo:cor" já processados
// em páginas anteriores, enviada como JSON array.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = requireAdmin(request)
  if (guard) return guard

  const pagina = parseInt(request.nextUrl.searchParams.get('pagina') ?? '1', 10) || 1

  // Chaves já processadas em lotes anteriores (deduplicação cross-page)
  let skipKeys: string[] = []
  try {
    const body = await request.json().catch(() => ({}))
    if (Array.isArray(body?.processados)) {
      skipKeys = body.processados
    }
  } catch { /* vazio é ok */ }

  const processados = new Set<string>(skipKeys)

  const counters: SyncBlingPageResult = {
    pagina,
    hasMore: false,
    processados: 0,
    criadas: 0,
    atualizadas: 0,
    semModelo: 0,
    semImagem: 0,
    imagensBaixadas: 0,
    erros: [],
  }

  try {
    const { data: produtos, hasMore } = await blingService.listProdutos(pagina)
    counters.hasMore = hasMore
    counters.processados = produtos.length

    for (const produto of produtos) {
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
  } catch (err) {
    counters.erros.push(err instanceof Error ? err.message : 'erro fatal')
  }

  return NextResponse.json({
    ...counters,
    // Retorna chaves processadas para o frontend enviar no próximo lote
    processadosKeys: Array.from(processados),
  })
}
