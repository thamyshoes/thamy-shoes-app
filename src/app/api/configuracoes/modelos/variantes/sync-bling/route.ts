import { NextRequest, NextResponse } from 'next/server'
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

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Baixa imagem remota do Bling e sobe para Supabase Storage.
 * Retorna URL pública permanente ou null se falhar.
 */
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

  // Se já tem imagem local (Supabase), não sobrescrever
  const jaTemImagemLocal = existente?.imagemUrl?.includes('supabase')

  let imagemUrl: string | null = existente?.imagemUrl ?? null

  if (imagemRemota && !jaTemImagemLocal) {
    const publicUrl = await downloadToSupabase(imagemRemota, modeloCodigo, corCodigo)
    if (publicUrl) {
      imagemUrl = publicUrl
      counters.imagensBaixadas++
    } else {
      // Fallback: não conseguiu baixar, não atualiza imagem
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

// POST /api/configuracoes/modelos/variantes/sync-bling
//
// Estratégia de dois níveis:
//
// Nível 1 — produto flat (SKU completo no próprio produto.codigo, ex: "1611501220"):
//   parseSku(produto.codigo) → modelo="16115", cor="012"
//   usa produto.imagemThumbnail → baixa para Supabase Storage.
//
// Nível 2 — produto pai (código não parseia completamente, ex: "16115"):
//   chama getProduto(id) → itera variacao.codigo + variacao.imagens
//   baixa imagem da variação para Supabase Storage.
//
// Variantes sem imagem: são criadas mesmo assim (sem o campo imagemUrl).
// Imagens já no Supabase: não são sobrescritas.
// Deduplicação: o primeiro par (modelo, cor) encontrado vence.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = requireAdmin(request)
  if (guard) return guard

  const counters: SyncBlingResult = {
    criadas: 0,
    atualizadas: 0,
    semModelo: 0,
    semImagem: 0,
    imagensBaixadas: 0,
    erros: [],
  }

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
          const chave = `${parsed.modelo}:${parsed.cor}`
          if (processados.has(chave)) continue
          processados.add(chave)

          const imagemUrl = produto.imagemThumbnail ?? null
          await upsertVariante(parsed.modelo, parsed.cor, imagemUrl, counters)
          continue
        }

        // ── Nível 2: produto pai com variações aninhadas ───────────────────
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
  }

  return NextResponse.json(counters)
}
