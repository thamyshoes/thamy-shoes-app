/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { h } from '@/lib/pdf/h-factory'
import { TemplateSimples } from './template-simples'
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
      { label: 'Material Sola', valor: item.modelo.materialSola },
      { label: 'Cor Sola', valor: item.variante.corSola ?? item.variante.corPrincipal },
      { label: 'Cor Principal', valor: item.variante.corPrincipal },
    ]}
    tamanhos={tamanhos}
  />
)
