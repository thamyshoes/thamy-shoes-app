/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { h } from '@/lib/pdf/h-factory'
import { TemplateSimples } from './template-simples'
import { formatCor } from '../pdf-types'
import type { PedidoData, ItemData } from '../pdf-types'

interface TemplateFachetaProps {
  pedido: PedidoData
  item: ItemData
  tamanhos: number[]
}

export const TemplateFacheta = ({ pedido, item, tamanhos }: TemplateFachetaProps) => {
  // Lógica condicional: só renderiza se facheta preenchida
  if (!item.modelo.facheta) return null

  return (
    <TemplateSimples
      titulo="FACHETA"
      pedido={pedido}
      item={item}
      especificacoes={[
        { label: 'REF Facheta', valor: item.modelo.facheta },
        { label: 'Cor Facheta', valor: formatCor(item.variante.corFacheta, item.variante.corFachetaDesc ?? item.variante.corPrincipal) },
        { label: 'Material Facheta', valor: item.modelo.materialFacheta },
        { label: 'REF Sola', valor: item.modelo.sola },
        { label: 'Cor Sola', valor: formatCor(item.variante.corSola, item.variante.corSolaDesc ?? item.variante.corPrincipal) },
      ]}
      tamanhos={tamanhos}
    />
  )
}
