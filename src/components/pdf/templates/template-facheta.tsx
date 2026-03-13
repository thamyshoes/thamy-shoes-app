/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { h } from '@/lib/pdf/h-factory'
import { TemplateSimples } from './template-simples'
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
        { label: 'Cor Facheta', valor: item.variante.corFacheta ?? item.variante.corPrincipal },
        { label: 'Material Facheta', valor: item.modelo.materialFacheta },
      ]}
      tamanhos={tamanhos}
    />
  )
}
