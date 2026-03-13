import { NextRequest, NextResponse } from 'next/server'
import { blingService } from '@/lib/bling/bling-service'
import { parseSku } from '@/lib/bling/sku-parser'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

export interface SyncBlingResult {
  criadas: number
  atualizadas: number
  semModelo: number
  semImagem: number
  erros: string[]
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function upsertVariante(
  modeloCodigo: string,
  corCodigo: string,
  imagemUrl: string,
  counters: { criadas: number; atualizadas: number; semModelo: number },
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
    select: { id: true },
  })

  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo } },
    update: { imagemUrl },
    create: { modeloId: modelo.id, corCodigo, imagemUrl },
  })

  if (existente) {
    counters.atualizadas++
  } else {
    counters.criadas++
  }
}

// ── route ─────────────────────────────────────────────────────────────────────

// POST /api/configuracoes/modelos/variantes/sync-bling
//
// Estratégia de dois níveis:
//
// Nível 1 — produto flat (SKU completo no próprio produto.codigo, ex: "1611501220"):
//   parseSku(produto.codigo) → modelo="16115", cor="012"
//   usa produto.imagemThumbnail diretamente — sem chamada extra ao Bling.
//
// Nível 2 — produto pai (código não parseia completamente, ex: "16115"):
//   chama getProduto(id) → itera variacao.codigo + variacao.imagens
//   útil se o catálogo Bling tiver produtos agrupados com variações aninhadas.
//
// Deduplicação: o primeiro par (modelo, cor) com imagem encontrado vence.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = requireAdmin(request)
  if (guard) return guard

  const counters = { criadas: 0, atualizadas: 0, semModelo: 0 }
  let semImagem = 0
  const erros: string[] = []

  // Pares "modeloCodigo:corCodigo" já processados — evita sobrescrever
  // com uma imagem pior quando múltiplos produtos representam a mesma variante.
  const processados = new Set<string>()

  let pagina = 1
  let hasMore = true

  while (hasMore) {
    const { data: produtos, hasMore: more } = await blingService.listProdutos(pagina)
    hasMore = more
    pagina++

    for (const produto of produtos) {
      try {
        // ── Nível 1: produto flat ──────────────────────────────────────────
        const parsed = await parseSku(produto.codigo)

        if (parsed.modelo && parsed.cor) {
          // SKU completo no código do produto — usa thumbnail da listagem.
          const imagemUrl = produto.imagemThumbnail ?? null
          if (!imagemUrl) {
            semImagem++
            continue
          }

          const chave = `${parsed.modelo}:${parsed.cor}`
          if (processados.has(chave)) continue
          processados.add(chave)

          await upsertVariante(parsed.modelo, parsed.cor, imagemUrl, counters)
          continue
        }

        // ── Nível 2: produto pai com variações aninhadas ───────────────────
        const detalhe = await blingService.getProduto(produto.id)
        if (!detalhe.variacoes?.length) continue

        for (const variacao of detalhe.variacoes) {
          if (!variacao.codigo) continue

          const imagemUrl = variacao.imagens?.[0]?.link ?? null
          if (!imagemUrl) {
            semImagem++
            continue
          }

          const parsedVar = await parseSku(variacao.codigo)
          if (!parsedVar.modelo || !parsedVar.cor) continue

          const chave = `${parsedVar.modelo}:${parsedVar.cor}`
          if (processados.has(chave)) continue
          processados.add(chave)

          await upsertVariante(parsedVar.modelo, parsedVar.cor, imagemUrl, counters)
        }
      } catch (err) {
        erros.push(
          `Produto ${produto.codigo}: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
        )
      }
    }
  }

  const result: SyncBlingResult = { ...counters, semImagem, erros }
  return NextResponse.json(result)
}
