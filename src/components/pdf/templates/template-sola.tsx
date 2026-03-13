/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { h } from '@/lib/pdf/h-factory'
import { TemplateSimples } from './template-simples'
import { formatCor } from '../pdf-types'
import type { PedidoData, ItemData } from '../pdf-types'

interface TemplateSolaProps {
  pedido: PedidoData
  item: ItemData
  tamanhos: number[]
}

export const TemplateSola = ({ pedido, item, tamanhos }: TemplateSolaProps) => (
  <TemplateSimples
    titulo="SOLA"
    pedido={pedido}
    item={item}
    especificacoes={[
      { label: 'REF Sola', valor: item.modelo.sola },
      { label: 'Cor Sola', valor: formatCor(item.variante.corSola, item.variante.corSolaDesc ?? item.variante.corPrincipal) },
      { label: 'Material Sola', valor: item.modelo.materialSola },
    ]}
    tamanhos={tamanhos}
  />
)
