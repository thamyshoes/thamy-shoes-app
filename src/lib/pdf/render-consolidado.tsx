/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { h } from '@/lib/pdf/h-factory'
import { PageLayout } from '@/components/pdf/page-layout'
import { TemplateCabedal } from '@/components/pdf/templates/template-cabedal'
import { TemplatePalmilha } from '@/components/pdf/templates/template-palmilha'
import { TemplateSola } from '@/components/pdf/templates/template-sola'
import { TemplateFacheta } from '@/components/pdf/templates/template-facheta'
import type { PedidoData, ItemData } from '@/components/pdf/pdf-types'
import { Setor } from '@/types'

export interface ConsolidadoCardData {
  pedido: PedidoData
  item: ItemData
  base64Imagem: string | null
  tamanhos: number[]
}

function buildCardElement(setor: Setor, card: ConsolidadoCardData): any {
  switch (setor) {
    case Setor.CABEDAL:
      return (
        <TemplateCabedal
          pedido={card.pedido}
          item={card.item}
          base64Imagem={card.base64Imagem}
          tamanhos={card.tamanhos}
        />
      )
    case Setor.PALMILHA:
      return (
        <TemplatePalmilha
          pedido={card.pedido}
          item={card.item}
          tamanhos={card.tamanhos}
        />
      )
    case Setor.SOLA:
      return (
        <TemplateSola
          pedido={card.pedido}
          item={card.item}
          tamanhos={card.tamanhos}
        />
      )
    case Setor.FACHETA:
      return (
        <TemplateFacheta
          pedido={card.pedido}
          item={card.item}
          tamanhos={card.tamanhos}
        />
      )
  }
}

/**
 * Renderiza o consolidado de cards em um único PDF com múltiplas páginas.
 * PageLayout agrupa automaticamente em 4 cards por página (wrap automático react-pdf).
 */
export async function renderConsolidadoPdf(
  setor: Setor,
  cards: ConsolidadoCardData[],
): Promise<Buffer> {
  // Filtrar cards sem dados relevantes para o setor ANTES de criar elementos JSX.
  // filter(Boolean) em JSX não funciona — React elements são sempre truthy.
  const relevantCards = setor === Setor.FACHETA
    ? cards.filter((c) => !!c.item.modelo.facheta)
    : cards

  const cardElements = relevantCards.map((card) => buildCardElement(setor, card))
  const document = <PageLayout cards={cardElements} cardsPerPage={setor === Setor.FACHETA ? 6 : 5} />
  return renderToBuffer(document as any)
}
