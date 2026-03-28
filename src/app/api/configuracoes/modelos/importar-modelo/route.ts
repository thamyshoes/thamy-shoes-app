import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { blingService } from '@/lib/bling/bling-service'
import { parseSku } from '@/lib/bling/sku-parser'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'
import { StorageService } from '@/lib/services/storage-service'
import { StatusItem } from '@/types'

export const maxDuration = 30

// ── Tipos internos ──────────────────────────────────────────────────────────

interface VarianteResult {
  cor: string
  corDescricao: string
  tamanhos: string[]
  totalSkus: number
  nome: string
  imagemUrl: string | null
  jaCadastrada: boolean
  fonte: 'local' | 'bling' | 'ambas'
}

// ── Allowlist de domínios para download de imagem (proteção SSRF) ────────────
// Mesmo allowlist usado pelo sync-bling

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

// ── Helper: acumular variante no mergedMap ──────────────────────────────────

type MergedEntry = {
  cor: string
  corDescricao: string
  tamanhos: Set<string>
  skus: Set<string>
  nome: string
  imagemUrl: string | null
  fonte: 'local' | 'bling' | 'ambas'
}

function acumularBling(
  mergedMap: Map<string, MergedEntry>,
  cor: string,
  tamanho: string,
  skuCodigo: string,
  nome: string,
  imagemUrl: string | null,
  codigo: string,
) {
  const existing = mergedMap.get(cor)
  if (existing) {
    existing.tamanhos.add(tamanho)
    existing.skus.add(skuCodigo)
    if (!existing.imagemUrl && imagemUrl) existing.imagemUrl = imagemUrl
    if (!existing.nome || existing.nome === `Modelo ${codigo}`) existing.nome = nome
    if (existing.fonte === 'local') existing.fonte = 'ambas'
  } else {
    mergedMap.set(cor, {
      cor,
      corDescricao: cor,
      tamanhos: new Set([tamanho]),
      skus: new Set([skuCodigo]),
      nome,
      imagemUrl,
      fonte: 'bling',
    })
  }
}

// ── GET: Buscar modelo por código ───────────────────────────────────────────

// Estratégia: merge de fontes (local + Bling) para resultado completo.
// 1. Busca local no banco (itens de pedido já parseados)
// 2. Busca no Bling via API (SKU direto + fallback variacoes do produto-pai)
// Depois faz merge por cor para não perder variantes que existem só em uma fonte.
export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const codigo = request.nextUrl.searchParams.get('codigo')?.trim()
  if (!codigo || codigo.length < 3) {
    return NextResponse.json(
      { error: 'Código deve ter pelo menos 3 caracteres' },
      { status: 400 },
    )
  }

  try {
    // Verificar pré-condição: regra SKU ativa
    const regraAtiva = await prisma.regraSkU.findFirst({ where: { ativa: true }, select: { id: true } })

    // Verificar se o modelo já existe no banco
    const modeloExistente = await prisma.modelo.findUnique({
      where: { codigo },
      select: { id: true, variantesCor: { select: { corCodigo: true } } },
    })
    const coresJaCadastradas = new Set(modeloExistente?.variantesCor.map((v) => v.corCodigo) ?? [])

    // Map acumulador: cor → dados da variante
    const mergedMap = new Map<string, MergedEntry>()

    let fonteLocal = false
    let fonteBling = false
    const warnings: string[] = []

    if (!regraAtiva) {
      warnings.push('Nenhuma regra SKU ativa — a busca no Bling não conseguirá interpretar os SKUs. Configure uma regra em Configurações > SKU.')
    }

    // ── FASE 1: Buscar no banco local (itens de pedido já parseados) ──
    const itensLocais = await prisma.itemPedido.findMany({
      where: { modelo: codigo, status: StatusItem.RESOLVIDO },
      select: { cor: true, corDescricao: true, tamanho: true, skuBruto: true },
    })

    if (itensLocais.length > 0) {
      fonteLocal = true
      for (const item of itensLocais) {
        if (!item.cor) continue
        if (!mergedMap.has(item.cor)) {
          mergedMap.set(item.cor, {
            cor: item.cor,
            corDescricao: item.corDescricao ?? item.cor,
            tamanhos: new Set(),
            skus: new Set(),
            nome: `Modelo ${codigo}`,
            imagemUrl: null,
            fonte: 'local',
          })
        }
        const grupo = mergedMap.get(item.cor)!
        if (item.tamanho) grupo.tamanhos.add(String(item.tamanho))
        if (item.skuBruto) grupo.skus.add(item.skuBruto)
      }
    }

    // ── FASE 2: Buscar no Bling (sempre, para complementar) ──
    let blingTruncated = false
    try {
      // situacao 'A' (padrão): evita explosão de resultados do criterio textual.
      // Produtos inativos são cobertos via findProdutoPaiPorCodigo + getProduto abaixo.
      const produtos = await blingService.searchProdutosByCodigo(codigo)
      if (produtos.length >= 500) blingTruncated = true

      // Produto-pai tem código exatamente igual ao modelo (ex: "8054").
      // Pode estar inativo — nesse caso não aparece na busca criterio com situacao='A'.
      // Buscamos por código exato (sem filtro de situação) para garantir nome e variacoes.
      const produtoPaiNaBusca = produtos.find((p) => p.codigo === codigo)
      const produtoPai = produtoPaiNaBusca ?? await blingService.findProdutoPaiPorCodigo(codigo)
      const nomeProdutoPai = produtoPai?.nome ?? `Modelo ${codigo}`

      // IDs de produtos-pai cujo SKU direto não parseou — candidatos ao fallback variacoes
      const produtosPaiFallback: { id: number; nome: string }[] = []

      for (const p of produtos) {
        const parsed = await parseSku(p.codigo)

        if (parsed.modelo && parsed.cor && parsed.tamanho && parsed.modelo === codigo) {
          // SKU direto parseou com sucesso — usa nome do produto-pai (não da variação)
          fonteBling = true
          acumularBling(mergedMap, parsed.cor, parsed.tamanho, p.codigo, nomeProdutoPai, p.imagemThumbnail ?? null, codigo)
        } else {
          // SKU não parseou ou modelo não bate — pode ser produto-pai
          // Produto-pai no Bling geralmente tem código curto (ex: "1056") enquanto
          // as variações têm SKU completo (ex: "105601229")
          produtosPaiFallback.push({ id: p.id, nome: p.nome })
        }
      }

      // Garantir que o produto-pai (mesmo inativo) esteja na lista de fallback.
      // Assim getProduto(id) busca suas variacoes incluindo as inativas.
      if (produtoPai) {
        const jaIncluso = produtosPaiFallback.some((p) => p.id === produtoPai.id)
        if (!jaIncluso) {
          produtosPaiFallback.push({ id: produtoPai.id, nome: produtoPai.nome })
        }
      }

      // Fallback: buscar variacoes dos produtos-pai (mesmo padrão do sync-bling)
      for (const pai of produtosPaiFallback) {
        try {
          const detalhe = await blingService.getProduto(pai.id)
          if (!detalhe.variacoes?.length) continue

          for (const variacao of detalhe.variacoes) {
            const parsedVar = await parseSku(variacao.codigo)
            if (!parsedVar.modelo || !parsedVar.cor || !parsedVar.tamanho) continue
            if (parsedVar.modelo !== codigo) continue

            fonteBling = true
            const imgUrl = variacao.imagens?.[0]?.link ?? null
            // Usa pai.nome (nome do produto-pai) em vez de variacao.nome (descriptor da variação)
            acumularBling(mergedMap, parsedVar.cor, parsedVar.tamanho, variacao.codigo, pai.nome, imgUrl, codigo)
          }
        } catch (varErr) {
          console.warn(`[importar-modelo] Falha ao buscar variações do produto ${pai.id}:`, varErr)
        }
      }
    } catch (blingErr) {
      // Se Bling falhar mas temos dados locais, continuar sem erro fatal
      if (!fonteLocal) throw blingErr
      console.warn('[importar-modelo] Bling falhou, usando apenas dados locais:', blingErr)
      warnings.push('A busca no Bling falhou. Mostrando apenas dados locais.')
    }

    // Buscar descrições das cores para todas as cores encontradas
    const todasCores = [...mergedMap.keys()]
    if (todasCores.length > 0) {
      const mapeamentos = await prisma.mapeamentoCor.findMany({
        where: { codigo: { in: todasCores } },
        select: { codigo: true, descricao: true },
      })
      for (const m of mapeamentos) {
        const entry = mergedMap.get(m.codigo)
        if (entry && (entry.corDescricao === entry.cor)) {
          entry.corDescricao = m.descricao
        }
      }
    }

    const variantes: VarianteResult[] = [...mergedMap.values()]
      .map((v) => ({
        cor: v.cor,
        corDescricao: v.corDescricao,
        tamanhos: [...v.tamanhos].sort((a, b) => Number(a) - Number(b)),
        totalSkus: v.skus.size,
        nome: v.nome,
        imagemUrl: v.imagemUrl,
        jaCadastrada: coresJaCadastradas.has(v.cor),
        fonte: v.fonte,
      }))
      .sort((a, b) => a.cor.localeCompare(b.cor))

    const fonte = fonteLocal && fonteBling ? 'ambas' : fonteLocal ? 'local' : fonteBling ? 'bling' : 'nenhuma'
    const totalSkus = variantes.reduce((sum, v) => sum + v.totalSkus, 0)

    return NextResponse.json({
      modelo: codigo,
      modeloExiste: !!modeloExistente,
      total: totalSkus,
      fonte,
      blingTruncated,
      ...(warnings.length > 0 ? { warnings } : {}),
      variantes,
    })
  } catch (err) {
    console.error('[importar-modelo] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar' },
      { status: 500 },
    )
  }
}

// ── POST: Importar modelo e variantes selecionadas ──────────────────────────

const corSchema = z.object({
  cor: z.string().min(1),
  imagemUrl: z.string().nullable().optional(),
})

const importSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  cores: z.array(z.union([z.string(), corSchema])).min(1, 'Selecione pelo menos uma variante'),
})

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { codigo, nome } = parsed.data

  // Normalizar cores: aceita string[] ou { cor, imagemUrl }[]
  const coresNormalizadas = parsed.data.cores.map((c) =>
    typeof c === 'string' ? { cor: c, imagemUrl: null } : { cor: c.cor, imagemUrl: c.imagemUrl ?? null },
  )
  const corCodigos = coresNormalizadas.map((c) => c.cor)

  try {
    // Pré-processar imagens: download para Supabase (fora da transaction para não segurar lock)
    const imagensProcessadas = new Map<string, string | null>()
    for (const { cor, imagemUrl } of coresNormalizadas) {
      if (imagemUrl) {
        const publicUrl = await downloadToSupabase(imagemUrl, codigo, cor)
        imagensProcessadas.set(cor, publicUrl)
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const modelo = await tx.modelo.upsert({
        where: { codigo },
        update: {},
        create: { codigo, nome },
        select: { id: true, codigo: true },
      })

      let variantesCriadas = 0
      let imagensSalvas = 0
      for (const { cor: corCodigo, imagemUrl: imagemOriginal } of coresNormalizadas) {
        // Usar URL do Supabase se disponível, senão a original do Bling
        const imagemFinal = imagensProcessadas.get(corCodigo) ?? imagemOriginal

        const existente = await tx.modeloVarianteCor.findUnique({
          where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo } },
        })
        if (!existente) {
          await tx.modeloVarianteCor.create({
            data: {
              modeloId: modelo.id,
              corCodigo,
              ...(imagemFinal ? { imagemUrl: imagemFinal } : {}),
            },
          })
          variantesCriadas++
          if (imagemFinal) imagensSalvas++
        } else if (imagemFinal && !existente.imagemUrl) {
          await tx.modeloVarianteCor.update({
            where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo } },
            data: { imagemUrl: imagemFinal },
          })
          imagensSalvas++
        }
      }

      // Auto-criar MapeamentoCor para cores sem mapeamento
      const coresExistentes = await tx.mapeamentoCor.findMany({
        where: { codigo: { in: corCodigos } },
        select: { codigo: true },
      })
      const coresJaMapeadas = new Set(coresExistentes.map((c) => c.codigo))

      for (const corCod of corCodigos) {
        if (!coresJaMapeadas.has(corCod)) {
          await tx.mapeamentoCor.upsert({
            where: { codigo: corCod },
            update: {},
            create: { codigo: corCod, descricao: corCod },
          })
        }
      }

      // Auto-vincular itens de pedido existentes que têm este modelo
      const vinculados = await tx.itemPedido.updateMany({
        where: { modelo: codigo, modeloId: null },
        data: { modeloId: modelo.id },
      })

      return {
        modelo: modelo.codigo,
        modeloId: modelo.id,
        variantesCriadas,
        totalCores: corCodigos.length,
        itensVinculados: vinculados.count,
        imagensSalvas,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[importar-modelo] Erro ao importar:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao importar modelo' },
      { status: 500 },
    )
  }
}
