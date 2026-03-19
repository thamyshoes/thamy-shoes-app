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
  novos: number
  criadas: number
  atualizadas: number
  modelosCriados: number
  semImagem: number
  imagensBaixadas: number
  erros: string[]
  isFirstSync?: boolean
  totalPaginas?: number
}

// ── Allowlist de domínios para download de imagem (proteção SSRF) ────────────

const ALLOWED_IMAGE_HOSTS = new Set([
  'i.ibb.co',
  'images.bling.com.br',
  'www.bling.com.br',
  'bling.com.br',
  'cdn.bling.com.br',
])

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    return ALLOWED_IMAGE_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function downloadToSupabase(
  remoteUrl: string,
  modeloCodigo: string,
  corCodigo: string,
): Promise<string | null> {
  if (!isAllowedImageUrl(remoteUrl)) return null

  const ext = remoteUrl.match(/\.(jpe?g|png|webp)/i)?.[1] ?? 'jpg'
  const fileName = `${modeloCodigo}-${corCodigo}.${ext}`
  return StorageService.uploadFromUrl(remoteUrl, fileName)
}

async function findOrCreateModelo(
  modeloCodigo: string,
  nomeSugerido: string | null,
  counters: Pick<SyncBlingPageResult, 'modelosCriados'>,
): Promise<string> {
  const existing = await prisma.modelo.findUnique({
    where: { codigo: modeloCodigo },
    select: { id: true },
  })
  if (existing) return existing.id

  const isVariationDesc = nomeSugerido && /tamanho:|cor:/i.test(nomeSugerido)
  const nome = (nomeSugerido && !isVariationDesc) ? nomeSugerido : `Modelo ${modeloCodigo}`

  const result = await prisma.modelo.upsert({
    where: { codigo: modeloCodigo },
    update: {},
    create: { codigo: modeloCodigo, nome },
    select: { id: true },
  })

  counters.modelosCriados++
  return result.id
}

/** Retorna true se a variante era nova (não existia no banco). */
async function upsertVariante(
  modeloId: string,
  modeloCodigo: string,
  corCodigo: string,
  imagemRemota: string | null,
  counters: Pick<SyncBlingPageResult, 'criadas' | 'atualizadas' | 'semImagem' | 'imagensBaixadas'>,
): Promise<boolean> {
  const existente = await prisma.modeloVarianteCor.findUnique({
    where: { modeloId_corCodigo: { modeloId, corCodigo } },
    select: { id: true, imagemUrl: true },
  })

  const jaTemImagemLocal = existente?.imagemUrl?.includes('supabase')
  let imagemUrl: string | null = existente?.imagemUrl ?? null

  if (imagemRemota && !jaTemImagemLocal) {
    const publicUrl = await downloadToSupabase(imagemRemota, modeloCodigo, corCodigo)
    if (publicUrl) {
      imagemUrl = publicUrl
      counters.imagensBaixadas++
    } else if (!existente?.imagemUrl) {
      counters.semImagem++
    }
  } else if (!imagemRemota && !existente?.imagemUrl) {
    counters.semImagem++
  }

  const hasUpdate = imagemUrl && !jaTemImagemLocal
  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId, corCodigo } },
    update: hasUpdate ? { imagemUrl } : {},
    create: { modeloId, corCodigo, imagemUrl },
  })

  if (existente) {
    if (hasUpdate) counters.atualizadas++
    return false
  } else {
    counters.criadas++
    return true
  }
}

/** Formata Date para o Bling v3: YYYY-MM-DD HH:MM:SS */
function formatBlingDatetime(d: Date): string {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
}

// ── route ─────────────────────────────────────────────────────────────────────

// POST /api/configuracoes/modelos/variantes/sync-bling?pagina=N
//
// Sync incremental: usa lastSyncProdutosAt do BlingConnection para buscar
// apenas produtos alterados desde a última sync (via dataAlteracaoInicial).
// Se nunca sincronizou, faz full sync (sem filtro de data).
//
// pagina=info → retorna se é full sync ou incremental + estimativa
// pagina=N   → processa página N
// pagina=done → marca sync como concluída (atualiza lastSyncProdutosAt)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = requireAdmin(request)
  if (guard) return guard

  const paginaParam = request.nextUrl.searchParams.get('pagina') ?? '1'

  // Buscar a conexão para saber lastSyncProdutosAt
  const connection = await prisma.blingConnection.findFirst({
    select: { id: true, lastSyncProdutosAt: true },
  })

  const lastSync = connection?.lastSyncProdutosAt ?? null
  // Se nunca sincronizou, busca apenas últimos 5 dias (não puxa catálogo inteiro)
  const DEFAULT_SYNC_DAYS = 5
  const desdeDate = lastSync
    ? new Date(lastSync.getTime() - 5 * 60 * 1000) // buffer 5min para alterações em trânsito
    : new Date(Date.now() - DEFAULT_SYNC_DAYS * 24 * 60 * 60 * 1000)
  const desde = formatBlingDatetime(desdeDate)

  // Modo info: retorna metadados da sync sem processar
  if (paginaParam === 'info') {
    try {
      const { data, hasMore } = await blingService.listProdutos(1, desde)
      return NextResponse.json({
        isFirstSync: !lastSync,
        hasMore,
        estimativa: data.length,
        desde: formatBlingDatetime(desdeDate),
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Erro ao consultar Bling' },
        { status: 500 },
      )
    }
  }

  // Modo done: marca sync como concluída
  if (paginaParam === 'done') {
    if (connection) {
      await prisma.blingConnection.update({
        where: { id: connection.id },
        data: { lastSyncProdutosAt: new Date() },
      })
    }
    return NextResponse.json({ ok: true })
  }

  const pagina = parseInt(paginaParam, 10) || 1
  const processadosNaPagina = new Set<string>()

  const counters: SyncBlingPageResult = {
    pagina,
    hasMore: false,
    processados: 0,
    novos: 0,
    criadas: 0,
    atualizadas: 0,
    modelosCriados: 0,
    semImagem: 0,
    imagensBaixadas: 0,
    erros: [],
    isFirstSync: !lastSync,
  }

  try {
    const { data: produtos, hasMore } = await blingService.listProdutos(pagina, desde)
    counters.hasMore = hasMore
    counters.processados = produtos.length

    for (const produto of produtos) {
      try {
        const parsed = await parseSku(produto.codigo)

        if (parsed.modelo && parsed.cor) {
          const chave = `${parsed.modelo}:${parsed.cor}`
          if (processadosNaPagina.has(chave)) continue
          processadosNaPagina.add(chave)

          const modeloId = await findOrCreateModelo(parsed.modelo, produto.nome ?? null, counters)
          const imagemUrl = produto.imagemThumbnail ?? null
          const isNew = await upsertVariante(modeloId, parsed.modelo, parsed.cor, imagemUrl, counters)
          if (isNew) counters.novos++
          continue
        }

        const detalhe = await blingService.getProduto(produto.id)
        if (!detalhe.variacoes?.length) continue

        for (const variacao of detalhe.variacoes) {
          if (!variacao.codigo) continue

          const parsedVar = await parseSku(variacao.codigo)
          if (!parsedVar.modelo || !parsedVar.cor) continue

          const chave = `${parsedVar.modelo}:${parsedVar.cor}`
          if (processadosNaPagina.has(chave)) continue
          processadosNaPagina.add(chave)

          const modeloId = await findOrCreateModelo(parsedVar.modelo, detalhe.nome ?? null, counters)
          const imagemUrl = variacao.imagens?.[0]?.link ?? null
          const isNew = await upsertVariante(modeloId, parsedVar.modelo, parsedVar.cor, imagemUrl, counters)
          if (isNew) counters.novos++
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

  return NextResponse.json(counters)
}
