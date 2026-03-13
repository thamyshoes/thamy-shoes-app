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

  const variante: VarianteData = {
    corPrincipal: grade.corDescricao,
    corCabedal:   grade.corCabedal,
    corSola:      grade.corSola,
    corPalmilha:  grade.corPalmilha,
    corFacheta:   grade.corFacheta,
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
    const totalPares = grades.reduce((acc, g) => acc + g.totalPares, 0)
    console.log('[gerarFichas] Total pares:', totalPares)

    const fichasGeradas: FichaGerada[] = []
    const avisos: string[] = []

    // Usar setores solicitados ou fallback para os 3 padrão
    const setores = setoresSolicitados ?? [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA]

    // Verificar se FACHETA foi solicitado: apenas incluir se algum modelo tem facheta preenchida
    const codigosModelo = [...new Set(pedido.itens.map((i) => i.modelo).filter((m): m is string => !!m))]
    let setoresFiltrados = setores
    if (setores.includes(Setor.FACHETA) && codigosModelo.length > 0) {
      const modelosComFacheta = await prisma.modelo.count({
        where: { codigo: { in: codigosModelo }, facheta: { not: null } },
      })
      if (modelosComFacheta === 0) {
        console.log('[gerarFichas] FACHETA solicitado mas nenhum modelo tem facheta — removendo setor')
        setoresFiltrados = setores.filter((s) => s !== Setor.FACHETA)
      }
    }

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
    }

    // Render and upload all PDFs in parallel (Promise.all)
    const pdfUploads = await Promise.all(
      setoresFiltrados.map(async (setor) => {
        console.log(`[gerarFichas] Renderizando PDF setor: ${setor}`)

        // Attach base64 images for CABEDAL grades
        const gradesComImagem = setor === Setor.CABEDAL && imagensBase64 && imagensBase64.size > 0
          ? grades.map((g) => ({
              ...g,
              imagemBase64: g.imagemUrl ? imagensBase64!.get(g.imagemUrl) ?? undefined : undefined,
            }))
          : grades

        const cards: ConsolidadoCardData[] = gradesComImagem.map((g) => gradeRowToCard(g, pedidoData))

        try {
          const pdfBuffer = await renderConsolidadoPdf(setor, cards)
          console.log(`[gerarFichas] PDF ${setor} renderizado, tamanho: ${pdfBuffer.length}`)

          const storagePath = `pedidos/${pedidoId}/${setor.toLowerCase()}.pdf`
          const pdfUrl = await this.uploadToStorage(pdfBuffer, storagePath)
          console.log(`[gerarFichas] PDF ${setor} upload OK: ${pdfUrl}`)

          return { setor, pdfUrl, totalCards: cards.length }
        } catch (renderErr) {
          console.error(`[gerarFichas] ERRO renderizando/upload ${setor}:`, renderErr instanceof Error ? renderErr.message : renderErr)
          console.error(`[gerarFichas] Stack ${setor}:`, renderErr instanceof Error ? renderErr.stack : '')
          throw renderErr
        }
      }),
    )

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
    const totalPares = grades.reduce((acc, g) => acc + g.totalPares, 0)
    const fichasGeradas: FichaGerada[] = []

    const pedidoNums = pedidos.map((p) => p.numero).join(', ')
    const pedidoData: PedidoData = {
      numero: pedidoNums,
      data:   new Date(),
    }

    // Include FACHETA only if any grade has facheta data
    const temFacheta = grades.some((g) => g.modeloFacheta)
    const setores = [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA, ...(temFacheta ? [Setor.FACHETA] : [])]

    // Render and upload all PDFs in parallel before persisting
    const pdfUploads = await Promise.all(
      setores.map(async (setor) => {
        const cards: ConsolidadoCardData[] = grades.map((g) => gradeRowToCard(g, pedidoData))
        const pdfBuffer = await renderConsolidadoPdf(setor, cards)
        return { setor, pdfBuffer, totalCards: cards.length }
      }),
    )

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
