import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient, FICHAS_BUCKET } from '@/lib/supabase-server'
import { montarGrades, montarGradesConsolidadas } from '@/lib/bling/sku-parser'
import { FichaTemplate } from '@/lib/pdf/templates/ficha-template'
import type { GradeRow } from '@/types'
import { Setor, StatusPedido } from '@/types'

export interface FichaGerada {
  id: string
  setor: Setor
  pdfUrl: string
  totalPares: number
}

export class PdfGeneratorService {
  // ── Gerar fichas individuais ────────────────────────────────────────────────

  async gerarFichas(pedidoId: string): Promise<FichaGerada[]> {
    const pedido = await prisma.pedidoCompra.findUnique({
      where: { id: pedidoId },
      include: { itens: true },
    })

    if (!pedido) throw new Error('Pedido não encontrado')
    if (pedido.status === StatusPedido.FICHAS_GERADAS) {
      throw new Error('Fichas já foram geradas para este pedido')
    }

    const itensPendentes = pedido.itens.filter((i) => i.status !== 'RESOLVIDO')
    if (itensPendentes.length > 0) {
      throw new Error('Existem itens pendentes. Resolva todos os itens antes de gerar fichas.')
    }

    if (pedido.itens.length === 0) {
      throw new Error('O pedido não possui itens')
    }

    const grades = await montarGrades(pedidoId)
    const totalPares = grades.reduce((acc, g) => acc + g.totalPares, 0)

    const fichasGeradas: FichaGerada[] = []
    const setores = [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA]

    // Render and upload all 3 PDFs in parallel (Promise.all)
    const pdfUploads = await Promise.all(
      setores.map(async (setor) => {
        const gradesSetor = this.aplicarEquivalencias(grades, setor)
        const camposExtras = await this.buscarCamposExtras(setor)

        const pdfBuffer = await this.renderPdf({
          numeroPedido: pedido.numero,
          dataEmissao: pedido.dataEmissao,
          fornecedor: pedido.fornecedorNome,
          setor,
          grades: gradesSetor,
          totalPares,
          camposExtras,
          geradoEm: new Date(),
        })

        const storagePath = `pedidos/${pedidoId}/${setor.toLowerCase()}.pdf`
        const pdfUrl = await this.uploadToStorage(pdfBuffer, storagePath)

        return { setor, pdfUrl, gradesSetor }
      }),
    )

    // Persist all records in a single transaction (rollback on failure)
    await prisma.$transaction(async (tx) => {
      for (const { setor, pdfUrl, gradesSetor } of pdfUploads) {
        const ficha = await tx.fichaProducao.create({
          data: {
            pedidoId,
            setor,
            pdfUrl,
            totalPares,
            dadosJson: gradesSetor as unknown as import('@prisma/client').Prisma.InputJsonValue,
          },
        })

        fichasGeradas.push({ id: ficha.id, setor, pdfUrl, totalPares })
      }

      await tx.pedidoCompra.update({
        where: { id: pedidoId },
        data: { status: StatusPedido.FICHAS_GERADAS },
      })
    })

    return fichasGeradas
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
      const itensPendentes = pedido.itens.filter((i) => i.status !== 'RESOLVIDO')
      if (itensPendentes.length > 0) {
        throw new Error(
          `Pedido ${pedido.numero} possui itens pendentes. Resolva todos antes de consolidar.`,
        )
      }
    }

    const grades = await montarGradesConsolidadas(pedidoIds, options)
    const totalPares = grades.reduce((acc, g) => acc + g.totalPares, 0)
    const fichasGeradas: FichaGerada[] = []

    const setores = [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA]
    const pedidoNums = pedidos.map((p) => p.numero).join(', ')

    // Render and upload all PDFs in parallel before persisting
    const pdfUploads = await Promise.all(
      setores.map(async (setor) => {
        const gradesSetor = this.aplicarEquivalencias(grades, setor)
        const camposExtras = await this.buscarCamposExtras(setor)

        const pdfBuffer = await this.renderPdf({
          numeroPedido: pedidoNums,
          dataEmissao: new Date(),
          fornecedor: 'Consolidado',
          setor,
          grades: gradesSetor,
          totalPares,
          camposExtras,
          geradoEm: new Date(),
        })

        return { setor, pdfBuffer, gradesSetor }
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

      for (const { setor, pdfBuffer, gradesSetor } of pdfUploads) {
        const storagePath = `consolidados/${consolidado.id}/${setor.toLowerCase()}.pdf`
        const pdfUrl = await this.uploadToStorage(pdfBuffer, storagePath)

        const ficha = await tx.fichaProducao.create({
          data: {
            consolidadoId: consolidado.id,
            setor,
            pdfUrl,
            totalPares,
            dadosJson: gradesSetor as unknown as import('@prisma/client').Prisma.InputJsonValue,
          },
        })

        fichasGeradas.push({ id: ficha.id, setor, pdfUrl, totalPares })
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

  private async renderPdf(props: {
    numeroPedido: string
    dataEmissao: Date
    fornecedor: string
    setor: Setor
    grades: GradeRow[]
    totalPares: number
    camposExtras: { nome: string; tipo: string; obrigatorio: boolean }[]
    geradoEm: Date
  }): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(FichaTemplate, props) as any
    return renderToBuffer(element)
  }

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

  private aplicarEquivalencias(grades: GradeRow[], _setor: Setor): GradeRow[] {
    // Todos os setores recebem as mesmas grades — equivalências futuras
    // serão aplicadas aqui quando o schema RegraEquivalencia incluir setorOrigem/Destino.
    return grades
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
