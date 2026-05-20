import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'
import { imageUrlToBase64 } from '@/lib/services/image-to-base64-converter'
import { StatusItem, Setor } from '@/types'
import type { ConsolidadoCardData } from '@/lib/pdf/render-consolidado'

// ST001: maxDuration para Vercel Pro (consolidados grandes)
export const maxDuration = 60

// ST001: Schema Zod com validação
const consolidarV2Schema = z.object({
  pedidoIds: z.array(z.string().uuid()).min(1),
  setores: z.array(z.enum(['CABEDAL', 'SOLA', 'PALMILHA', 'FACHETA'])).min(1),
  agruparPorFaixa: z.boolean().optional().default(false),
})

function classificarFaixa(tamanho: number): 'INFANTIL' | 'ADULTO' {
  return tamanho <= 27 ? 'INFANTIL' : 'ADULTO'
}

// ST004: Chunking utilitário — divide array em lotes de `size`
function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  )
}

export async function POST(req: NextRequest) {
  // ST001: Rate limiting — 10 req / min por IP (geração de PDF é custosa)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`consolidar:${ip}`, RATE_LIMIT_CONFIGS.consolidar)
  if (!rl.success) {
    const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde antes de gerar novamente.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    )
  }

  try {
    const body = await req.json()
    const parsed = consolidarV2Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { pedidoIds, setores, agruparPorFaixa } = parsed.data

    // ST002: Buscar itens de todos os pedidos selecionados (em paralelo com pedidos)
    const [itens, pedidos] = await Promise.all([
      prisma.itemPedido.findMany({
        where: {
          pedidoId: { in: pedidoIds },
          status: StatusItem.RESOLVIDO,
          modelo: { not: null },
          cor: { not: null },
          tamanho: { not: null },
        },
      }),
      prisma.pedidoCompra.findMany({
        where: { id: { in: pedidoIds } },
        select: { id: true, numero: true, dataEmissao: true, fornecedorNome: true },
      }),
    ])

    const pedidoMap = new Map(pedidos.map((p) => [p.id, p]))

    // ST003: Lógica de agrupamento por setor — cards DISTINTOS por pedido+modelo+cor
    const modeloCodigos = [...new Set(itens.map((i) => i.modelo!).filter(Boolean))]
    const corCodigos = [...new Set(itens.map((i) => i.cor!).filter(Boolean))]

    // Buscar Modelo primeiro para obter os IDs necessários para VarianteCor
    const modelos =
      modeloCodigos.length > 0
        ? await prisma.modelo.findMany({ where: { codigo: { in: modeloCodigos } } })
        : []

    const modeloIds = modelos.map((m) => m.id)

    // Buscar VarianteCor com modeloIds resolvidos
    const variantesCorReal =
      modeloIds.length > 0 && corCodigos.length > 0
        ? await prisma.modeloVarianteCor.findMany({
            where: {
              modeloId: { in: modeloIds },
              corCodigo: { in: corCodigos },
            },
          })
        : []

    // FIX P2: Resolver descrições de cores por componente via MapeamentoCor.
    // O fluxo V2 não resolvia corPalmilhaDesc/corSolaDesc/corCabedalDesc/corFachetaDesc,
    // fazendo o template cair no fallback corPrincipal (cor do produto, não do componente).
    const codigosComponentes = new Set<string>()
    for (const v of variantesCorReal) {
      if (v.corCabedal) codigosComponentes.add(v.corCabedal)
      if (v.corSola) codigosComponentes.add(v.corSola)
      if (v.corPalmilha) codigosComponentes.add(v.corPalmilha)
      if (v.corFacheta) codigosComponentes.add(v.corFacheta)
    }
    const mapeamentosComponentes =
      codigosComponentes.size > 0
        ? await prisma.mapeamentoCor.findMany({
            where: { codigo: { in: [...codigosComponentes] } },
            select: { codigo: true, descricao: true },
          })
        : []
    const corDescMap = new Map(mapeamentosComponentes.map((m) => [m.codigo, m.descricao]))
    const descCor = (codigo: string | null | undefined): string | null =>
      codigo ? (corDescMap.get(codigo) ?? codigo) : null

    const modeloMap = new Map(modelos.map((m) => [m.codigo, m]))
    const modeloIdToCodigoMap = new Map(modelos.map((m) => [m.id, m.codigo]))
    const varianteMap = new Map(
      variantesCorReal.map((v) => [
        `${modeloIdToCodigoMap.get(v.modeloId)}:${v.corCodigo}`,
        v,
      ]),
    )

    // ST003: Agrupar itens por (pedidoId, modelo, cor) — cards SEPARADOS entre pedidos
    type GroupKey = string
    const cardGroupMap = new Map<
      GroupKey,
      {
        pedidoId: string
        modelo: string
        cor: string
        corDescricao: string
        skuBruto: string | null
        quantidades: Map<number, number>
      }
    >()

    for (const item of itens) {
      const faixa = agruparPorFaixa ? classificarFaixa(item.tamanho!) : null
      const key: GroupKey = faixa
        ? `${item.pedidoId}:${item.modelo}:${item.cor}:${faixa}`
        : `${item.pedidoId}:${item.modelo}:${item.cor}`
      if (!cardGroupMap.has(key)) {
        cardGroupMap.set(key, {
          pedidoId: item.pedidoId,
          modelo: item.modelo!,
          cor: item.cor!,
          corDescricao: item.corDescricao ?? item.cor!,
          skuBruto: item.skuBruto,
          quantidades: new Map(),
        })
      }
      const group = cardGroupMap.get(key)!
      const current = group.quantidades.get(item.tamanho!) ?? 0
      group.quantidades.set(item.tamanho!, current + item.quantidade)
    }

    const cardGroups = Array.from(cardGroupMap.values())

    // ST006: Converter imagens para base64 (CABEDAL) — busca em paralelo
    const imagensBase64 = new Map<string, string | null>()
    if (setores.includes('CABEDAL')) {
      const uniqueVarKeys = [...new Set(cardGroups.map((g) => `${g.modelo}:${g.cor}`))]
      await Promise.all(
        uniqueVarKeys.map(async (varKey) => {
          const url = varianteMap.get(varKey)?.imagemUrl ?? null
          const base64 = await imageUrlToBase64(url)
          imagensBase64.set(varKey, base64)
        }),
      )
    }

    // ST004: Chunking lógico — 20 cards por lote para evitar timeout
    const chunks = chunkArray(cardGroups, 20)
    const allCardGroups: typeof cardGroups = []
    for (const chunk of chunks) {
      allCardGroups.push(...chunk)
    }

    // Construir ConsolidadoCardData para cada grupo
    const consolidadoCards: ConsolidadoCardData[] = allCardGroups.map((g) => {
      const pedido = pedidoMap.get(g.pedidoId)
      const modeloData = modeloMap.get(g.modelo)
      const varKey = `${g.modelo}:${g.cor}`
      const varianteData = varianteMap.get(varKey)
      const tamanhos = Array.from(g.quantidades.keys()).sort((a, b) => a - b)

      return {
        pedido: {
          numero: pedido?.numero ?? g.pedidoId.slice(0, 8),
          data: pedido?.dataEmissao ?? new Date(),
          fornecedor: pedido?.fornecedorNome ?? '',
        },
        item: {
          sku: g.skuBruto ?? `${g.modelo}-${g.cor}`,
          modelo: {
            codigo:           modeloData?.codigo,
            cabedal:          modeloData?.cabedal,
            sola:             modeloData?.sola,
            palmilha:         modeloData?.palmilha,
            facheta:          modeloData?.facheta,
            materialCabedal:  modeloData?.materialCabedal,
            materialSola:     modeloData?.materialSola,
            materialPalmilha: modeloData?.materialPalmilha,
            materialFacheta:  modeloData?.materialFacheta,
          },
          variante: {
            corPrincipal:    g.corDescricao,
            corCabedal:      varianteData?.corCabedal,
            corSola:         varianteData?.corSola,
            corPalmilha:     varianteData?.corPalmilha,
            corFacheta:      varianteData?.corFacheta,
            // FIX P2: populando descrições individuais por componente via MapeamentoCor
            corCabedalDesc:  descCor(varianteData?.corCabedal),
            corSolaDesc:     descCor(varianteData?.corSola),
            corPalmilhaDesc: descCor(varianteData?.corPalmilha),
            corFachetaDesc:  descCor(varianteData?.corFacheta),
            imagemBase64:    imagensBase64.get(varKey) ?? null,
          },
          quantidades: Object.fromEntries(g.quantidades),
        },
        base64Imagem: imagensBase64.get(varKey) ?? null,
        tamanhos,
      }
    })

    // FIX P1: Auto-detectar FACHETA quando algum card tem Modelo.facheta preenchido.
    // O frontend sempre enviava apenas CABEDAL/SOLA/PALMILHA; FACHETA nunca era gerada.
    const temFacheta = consolidadoCards.some((c) => !!c.item.modelo.facheta)
    const setoresSet = new Set<Setor>(setores as Setor[])
    if (temFacheta) setoresSet.add(Setor.FACHETA)
    const setoresFinais = [...setoresSet]

    // ST005: Gerar 1 PDF por setor com react-pdf.
    // Renderização SEQUENCIAL — yoga-layout (WASM) é instável com Promise.all.
    const { renderConsolidadoPdf } = await import('@/lib/pdf/render-consolidado')

    const resultados = []
    for (const setorStr of setoresFinais) {
      const setor = setorStr as Setor

      // Calcular cards relevantes para este setor (FACHETA filtra por modelo.facheta)
      const cardsDoSetor =
        setor === Setor.FACHETA
          ? consolidadoCards.filter((c) => !!c.item.modelo.facheta)
          : consolidadoCards

      // Omitir setor sem cards para evitar PDF vazio
      if (cardsDoSetor.length === 0) continue

      const pdfBuffer = await renderConsolidadoPdf(setor, cardsDoSetor)

      resultados.push({
        setor: setorStr,
        pdfBase64: pdfBuffer.toString('base64'),
        totalCards: cardsDoSetor.length,
        chunks: Math.ceil(cardsDoSetor.length / 20),
      })
    }

    return NextResponse.json(resultados)
  } catch (err) {
    console.error('[api/consolidar] ERRO:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Erro ao gerar consolidado. Tente novamente.' },
      { status: 500 },
    )
  }
}
