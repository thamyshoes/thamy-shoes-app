import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient, FICHAS_BUCKET } from '@/lib/supabase-server'
import { montarGrades, montarGradesConsolidadas } from '@/lib/bling/sku-parser'
import { imageUrlToBase64 } from '@/lib/services/image-to-base64-converter'
import { renderConsolidadoPdf } from '@/lib/pdf/render-consolidado'
import type { ConsolidadoCardData } from '@/lib/pdf/render-consolidado'
import type { PedidoData, ModeloData, VarianteData, ItemData } from '@/components/pdf/pdf-types'
import type { GradeRow } from '@/types'
import { Setor, StatusPedido, StatusItem } from '@/types'

export interface FichaGerada {
  id: string
  fichaProducaoId: string
  setor: Setor
  pdfUrl: string
  totalPares: number
  totalCards: number
}

// ── Adapter: GradeRow → ConsolidadoCardData ──────────────────────────────────

function gradeRowToCard(
  grade: GradeRow & { imagemBase64?: string },
  pedidoData: PedidoData,
  corDescMap?: Map<string, string>,
): ConsolidadoCardData {
  const tamanhos = Object.keys(grade.tamanhos)
    .map(Number)
    .sort((a, b) => a - b)

  const quantidades: Record<number, number> = {}
  for (const [k, v] of Object.entries(grade.tamanhos)) {
    quantidades[Number(k)] = v
  }

  const modelo: ModeloData = {
    codigo:           grade.modelo,
    cabedal:          grade.modeloCabedal,
    sola:             grade.modeloSola,
    palmilha:         grade.modeloPalmilha,
    facheta:          grade.modeloFacheta,
    materialCabedal:  grade.materialCabedal,
    materialSola:     grade.materialSola,
    materialPalmilha: grade.materialPalmilha,
    materialFacheta:  grade.materialFacheta,
  }

  // Resolver descrição de cada cor de componente via MapeamentoCor
  // Em vez de usar corPrincipal para todos, buscar a descrição real de cada código
  const resolverDesc = (code: string | undefined) => {
    if (!code) return undefined
    return corDescMap?.get(code) ?? code
  }

  const variante: VarianteData = {
    corPrincipal: grade.corDescricao,
    corCabedal:   grade.corCabedal,
    corSola:      grade.corSola,
    corPalmilha:  grade.corPalmilha,
    corFacheta:   grade.corFacheta,
    // Descrições resolvidas individualmente
    corCabedalDesc:  resolverDesc(grade.corCabedal ?? undefined),
    corSolaDesc:     resolverDesc(grade.corSola ?? undefined),
    corPalmilhaDesc: resolverDesc(grade.corPalmilha ?? undefined),
    corFachetaDesc:  resolverDesc(grade.corFacheta ?? undefined),
    imagemBase64: grade.imagemBase64 ?? null,
  }

  const item: ItemData = {
    sku:         `${grade.modelo}-${grade.cor}`,
    modelo,
    variante,
    quantidades,
  }

  return {
    pedido:       pedidoData,
    item,
    base64Imagem: grade.imagemBase64 ?? null,
    tamanhos,
  }
}

/**
 * Agrupa cards por cor do componente relevante ao setor.
 * SOLA: agrupa por modelo + corSola (mesma sola, soma quantidades)
 * PALMILHA: agrupa por modelo + corPalmilha
 * FACHETA: agrupa por modelo + corFacheta
 * CABEDAL: sem agrupamento (cada cor de cabedal é uma ficha distinta)
 */
function mergeCardsPorSetor(setor: Setor, cards: ConsolidadoCardData[]): ConsolidadoCardData[] {
  if (setor === Setor.CABEDAL) return cards

  // Para FACHETA: descartar cards sem facheta antes de agrupar
  if (setor === Setor.FACHETA) {
    cards = cards.filter((c) => !!c.item.modelo.facheta)
  }

  // Determinar ref e cor do componente para chave de agrupamento
  const getRefComponente = (card: ConsolidadoCardData): string | null => {
    switch (setor) {
      case Setor.SOLA:     return card.item.modelo.sola ?? null
      case Setor.PALMILHA: return card.item.modelo.palmilha ?? null
      case Setor.FACHETA:  return card.item.modelo.facheta ?? null
      default:             return null
    }
  }
  const getCorComponente = (card: ConsolidadoCardData): string | null => {
    switch (setor) {
      case Setor.SOLA:     return card.item.variante.corSola ?? null
      case Setor.PALMILHA: return card.item.variante.corPalmilha ?? null
      case Setor.FACHETA:  return card.item.variante.corFacheta ?? null
      default:             return null
    }
  }
  const getMaterialComponente = (card: ConsolidadoCardData): string | null => {
    switch (setor) {
      case Setor.PALMILHA: return card.item.modelo.materialPalmilha ?? null
      case Setor.FACHETA:  return card.item.modelo.materialFacheta ?? null
      default:             return null
    }
  }

  const grupos = new Map<string, ConsolidadoCardData>()

  for (const card of cards) {
    const refComp      = getRefComponente(card)
    const corComp      = getCorComponente(card)
    const materialComp = getMaterialComponente(card)
    // Se ref ou cor do componente estiver ausente, não mergear — usar SKU como chave única
    // Para PALMILHA e FACHETA, o material também integra a chave de agrupamento
    const key = refComp && corComp
      ? `${refComp}||${corComp}||${materialComp ?? ''}||${card.pedido.numero}`
      : `__nomatch__${card.item.sku}||${card.pedido.numero}`

    const existing = grupos.get(key)
    if (!existing) {
      // Clonar o card para não mutar o original
      grupos.set(key, {
        ...card,
        item: {
          ...card.item,
          quantidades: { ...card.item.quantidades },
        },
        tamanhos: [...card.tamanhos],
      })
    } else {
      // Somar quantidades e unir tamanhos
      for (const [tam, qty] of Object.entries(card.item.quantidades)) {
        const t = Number(tam)
        existing.item.quantidades[t] = (existing.item.quantidades[t] ?? 0) + qty
      }
      for (const t of card.tamanhos) {
        if (!existing.tamanhos.includes(t)) {
          existing.tamanhos.push(t)
        }
      }
    }
  }

  // Ordenar tamanhos uma vez após todo o merge
  for (const card of grupos.values()) {
    card.tamanhos.sort((a, b) => a - b)
  }

  return [...grupos.values()]
}

/** Coleta todos os códigos de cor de componentes e busca descrições no MapeamentoCor */
async function buildCorDescMap(grades: GradeRow[]): Promise<Map<string, string>> {
  const codigos = new Set<string>()
  for (const g of grades) {
    if (g.corCabedal) codigos.add(g.corCabedal)
    if (g.corSola) codigos.add(g.corSola)
    if (g.corPalmilha) codigos.add(g.corPalmilha)
    if (g.corFacheta) codigos.add(g.corFacheta)
  }
  if (codigos.size === 0) return new Map()

  const mapeamentos = await prisma.mapeamentoCor.findMany({
    where: { codigo: { in: [...codigos] } },
    select: { codigo: true, descricao: true },
  })
  return new Map(mapeamentos.map((m) => [m.codigo, m.descricao]))
}

// ─────────────────────────────────────────────────────────────────────────────

export class PdfGeneratorService {
  // ── Gerar fichas individuais ────────────────────────────────────────────────

  async gerarFichas(pedidoId: string, setoresSolicitados?: Setor[]): Promise<{ fichas: FichaGerada[]; avisos: string[] }> {
    console.log('[gerarFichas] Iniciando para pedidoId:', pedidoId)

    const pedido = await prisma.pedidoCompra.findUnique({
      where: { id: pedidoId },
      include: { itens: true },
    })
    console.log('[gerarFichas] Pedido encontrado:', !!pedido, 'status:', pedido?.status, 'itens:', pedido?.itens?.length)

    if (!pedido) throw new Error('Pedido não encontrado')

    const itensPendentes = pedido.itens.filter((i) => i.status !== StatusItem.RESOLVIDO)
    console.log('[gerarFichas] Itens pendentes:', itensPendentes.length, 'de', pedido.itens.length)
    if (itensPendentes.length > 0) {
      throw new Error('Existem itens pendentes. Resolva todos os itens antes de gerar fichas.')
    }

    if (pedido.itens.length === 0) {
      throw new Error('O pedido não possui itens')
    }

    console.log('[gerarFichas] Montando grades...')
    const grades = await montarGrades(pedidoId)
    console.log('[gerarFichas] Grades montadas:', grades.length)
    const corDescMap = await buildCorDescMap(grades)
    const totalPares = grades.reduce((acc, g) => acc + g.totalPares, 0)
    console.log('[gerarFichas] Total pares:', totalPares)

    const fichasGeradas: FichaGerada[] = []
    const avisos: string[] = []

    // Detectar se algum modelo do pedido tem facheta
    const codigosModelo = [...new Set(pedido.itens.map((i) => i.modelo).filter((m): m is string => !!m))]
    let temFacheta = false
    if (codigosModelo.length > 0) {
      const modelosComFacheta = await prisma.modelo.count({
        where: { codigo: { in: codigosModelo }, facheta: { not: null } },
      })
      temFacheta = modelosComFacheta > 0
    }

    // Usar setores solicitados ou auto-detectar (inclui FACHETA se algum modelo tem)
    const setoresBase = setoresSolicitados ?? [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA]
    const setoresFiltrados = temFacheta && !setoresBase.includes(Setor.FACHETA)
      ? [...setoresBase, Setor.FACHETA]
      : temFacheta
        ? setoresBase
        : setoresBase.filter((s) => s !== Setor.FACHETA)

    console.log('[gerarFichas] temFacheta:', temFacheta, 'setores:', setoresFiltrados)

    // Pre-convert images to base64 for CABEDAL setor (runs once, shared across renders)
    let imagensBase64: Map<string, string> | undefined
    if (setoresFiltrados.includes(Setor.CABEDAL)) {
      const urlsUnicas = [...new Set(grades.map((g) => g.imagemUrl).filter((u): u is string => !!u))]
      if (urlsUnicas.length > 0) {
        const conversoes = await Promise.all(urlsUnicas.map(async (url) => {
          const b64 = await imageUrlToBase64(url)
          return [url, b64] as const
        }))
        imagensBase64 = new Map(conversoes.filter(([, b64]) => b64 !== null) as [string, string][])
        console.log(`[gerarFichas] Imagens convertidas para CABEDAL: ${imagensBase64.size}/${urlsUnicas.length}`)
      }

      // Detectar grades sem imagem de variante e gerar aviso
      const gradesSemImagem = grades.filter((g) => !g.imagemUrl)
      if (gradesSemImagem.length > 0) {
        const nomes = gradesSemImagem.map((g) => `${g.modelo} cor ${g.cor ?? '?'}`).join(', ')
        const aviso = `CABEDAL: ${gradesSemImagem.length} grade(s) sem imagem de variante — ${nomes}. Cadastre a variante de cor em Configurações > Modelos.`
        console.warn('[gerarFichas]', aviso)
        avisos.push(aviso)
      }
    }

    const pedidoData: PedidoData = {
      numero: pedido.numero,
      data:   pedido.dataEmissao,
      fornecedor: pedido.fornecedorNome,
    }

    // Render and upload PDFs sequentially (yoga-layout WASM crashes with parallel renders)
    const pdfUploads: { setor: Setor; pdfUrl: string; totalCards: number }[] = []
    for (const setor of setoresFiltrados) {
      console.log(`[gerarFichas] Renderizando PDF setor: ${setor}`)

      // Attach base64 images for CABEDAL grades
      const gradesComImagem = setor === Setor.CABEDAL && imagensBase64 && imagensBase64.size > 0
        ? grades.map((g) => ({
            ...g,
            imagemBase64: g.imagemUrl ? imagensBase64!.get(g.imagemUrl) ?? undefined : undefined,
          }))
        : grades

      const cardsRaw: ConsolidadoCardData[] = gradesComImagem.map((g) => gradeRowToCard(g, pedidoData, corDescMap))
      const cards = mergeCardsPorSetor(setor, cardsRaw)

      const pdfBuffer = await renderConsolidadoPdf(setor, cards)
      console.log(`[gerarFichas] PDF ${setor} renderizado, tamanho: ${pdfBuffer.length}`)

      const storagePath = `pedidos/${pedidoId}/${setor.toLowerCase()}.pdf`
      const pdfUrl = await this.uploadToStorage(pdfBuffer, storagePath)
      console.log(`[gerarFichas] PDF ${setor} upload OK: ${pdfUrl}`)

      pdfUploads.push({ setor, pdfUrl, totalCards: cards.length })
    }

    console.log('[gerarFichas] Todos PDFs prontos, persistindo no banco...')

    // Persist all records in a single transaction (rollback on failure)
    const geradoEm = new Date().toISOString()
    await prisma.$transaction(async (tx) => {
      // Deletar fichas antigas dos setores que serão regerados
      await tx.fichaProducao.deleteMany({
        where: {
          pedidoId,
          setor: { in: pdfUploads.map((u) => u.setor) },
        },
      })

      for (const { setor, pdfUrl, totalCards } of pdfUploads) {
        const dadosJson = {
          setor,
          pedidoId,
          totalCards,
          geradoEm,
          itens: pedido.itens.map((i) => ({
            sku: i.skuBruto,
            modelo: i.modelo,
            cor: i.cor,
          })),
        }

        const ficha = await tx.fichaProducao.create({
          data: {
            pedidoId,
            setor,
            pdfUrl,
            totalPares,
            dadosJson: dadosJson as unknown as import('@prisma/client').Prisma.InputJsonValue,
          },
        })

        fichasGeradas.push({ id: ficha.id, fichaProducaoId: ficha.id, setor, pdfUrl, totalPares, totalCards })
      }

      await tx.pedidoCompra.update({
        where: { id: pedidoId },
        data: { status: StatusPedido.FICHAS_GERADAS },
      })
    })

    console.log('[gerarFichas] Transação OK, fichas criadas:', fichasGeradas.length)
    return { fichas: fichasGeradas, avisos }
  }

  // ── Gerar fichas consolidadas ───────────────────────────────────────────────

  async gerarFichasConsolidadas(pedidoIds: string[], options?: { agruparPorFaixa?: boolean }): Promise<FichaGerada[]> {
    const pedidos = await prisma.pedidoCompra.findMany({
      where: { id: { in: pedidoIds } },
      include: { itens: true },
    })

    if (pedidos.length !== pedidoIds.length) {
      throw new Error('Um ou mais pedidos não foram encontrados')
    }

    for (const pedido of pedidos) {
      const itensPendentes = pedido.itens.filter((i) => i.status !== StatusItem.RESOLVIDO)
      if (itensPendentes.length > 0) {
        throw new Error(
          `Pedido ${pedido.numero} possui itens pendentes. Resolva todos antes de consolidar.`,
        )
      }
    }

    const grades = await montarGradesConsolidadas(pedidoIds, options)
    const corDescMap = await buildCorDescMap(grades)
    const totalPares = grades.reduce((acc, g) => acc + g.totalPares, 0)
    const fichasGeradas: FichaGerada[] = []

    const pedidoNums = pedidos.map((p) => p.numero).join(', ')
    const fornecedores = [...new Set(pedidos.map((p) => p.fornecedorNome).filter(Boolean))]
    const pedidoData: PedidoData = {
      numero: pedidoNums,
      data:   new Date(),
      fornecedor: fornecedores.join(', '),
    }

    // Include FACHETA only if any grade has facheta data
    const temFacheta = grades.some((g) => g.modeloFacheta)
    const setores = [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA, ...(temFacheta ? [Setor.FACHETA] : [])]

    // Render PDFs sequentially (yoga-layout WASM crashes with parallel renders)
    const pdfUploads: { setor: Setor; pdfBuffer: Buffer; totalCards: number }[] = []
    for (const setor of setores) {
      const cardsRaw: ConsolidadoCardData[] = grades.map((g) => gradeRowToCard(g, pedidoData, corDescMap))
      const cards = mergeCardsPorSetor(setor, cardsRaw)
      const pdfBuffer = await renderConsolidadoPdf(setor, cards)
      pdfUploads.push({ setor, pdfBuffer, totalCards: cards.length })
    }

    await prisma.$transaction(async (tx) => {
      const consolidado = await tx.consolidado.create({ data: {} })
      await tx.consolidadoPedido.createMany({
        data: pedidoIds.map((pid) => ({
          consolidadoId: consolidado.id,
          pedidoId: pid,
        })),
      })

      const geradoEmConsolidado = new Date().toISOString()
      const allItens = pedidos.flatMap((p) => p.itens.map((i) => ({
        sku: i.skuBruto,
        modelo: i.modelo,
        cor: i.cor,
      })))

      for (const { setor, pdfBuffer, totalCards } of pdfUploads) {
        const storagePath = `consolidados/${consolidado.id}/${setor.toLowerCase()}.pdf`
        const pdfUrl = await this.uploadToStorage(pdfBuffer, storagePath)

        const dadosJson = {
          setor,
          pedidoIds,
          totalCards,
          geradoEm: geradoEmConsolidado,
          itens: allItens,
        }

        const ficha = await tx.fichaProducao.create({
          data: {
            consolidadoId: consolidado.id,
            setor,
            pdfUrl,
            totalPares,
            dadosJson: dadosJson as unknown as import('@prisma/client').Prisma.InputJsonValue,
          },
        })

        fichasGeradas.push({ id: ficha.id, fichaProducaoId: ficha.id, setor, pdfUrl, totalPares, totalCards })
      }
    })

    return fichasGeradas
  }

  // ── Download de ficha (retorna buffer) ─────────────────────────────────────

  async downloadFicha(fichaId: string): Promise<{ buffer: Buffer; filename: string }> {
    const ficha = await prisma.fichaProducao.findUnique({ where: { id: fichaId } })
    if (!ficha) throw new Error('Ficha não encontrada')

    const supabase = createServerSupabaseClient()
    const storagePath = ficha.pdfUrl.split(`${FICHAS_BUCKET}/`)[1]

    const { data, error } = await supabase.storage.from(FICHAS_BUCKET).download(storagePath)
    if (error || !data) throw new Error('Erro ao baixar ficha do storage')

    const buffer = Buffer.from(await data.arrayBuffer())
    const filename = `ficha-${ficha.setor.toLowerCase()}-${fichaId.slice(0, 8)}.pdf`

    return { buffer, filename }
  }

  // ── Privados ────────────────────────────────────────────────────────────────

  private async uploadToStorage(buffer: Buffer, storagePath: string): Promise<string> {
    const supabase = createServerSupabaseClient()

    const { error } = await supabase.storage.from(FICHAS_BUCKET).upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

    if (error) throw new Error(`Erro ao fazer upload do PDF: ${error.message}`)

    const { data } = supabase.storage.from(FICHAS_BUCKET).getPublicUrl(storagePath)
    return data.publicUrl
  }

  private async buscarCamposExtras(
    setor: Setor,
  ): Promise<{ nome: string; tipo: string; obrigatorio: boolean }[]> {
    const campos = await prisma.campoExtra.findMany({
      where: { setor, ativo: true },
      orderBy: { ordem: 'asc' },
    })

    return campos.map((c) => ({
      nome: c.nome,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
    }))
  }
}

export const pdfGeneratorService = new PdfGeneratorService()
