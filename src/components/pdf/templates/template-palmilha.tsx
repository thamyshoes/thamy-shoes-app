/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { h } from '@/lib/pdf/h-factory'
import { TemplateSimples } from './template-simples'
import { formatCor } from '../pdf-types'
import type { PedidoData, ItemData } from '../pdf-types'

interface TemplatePalmilhaProps {
  pedido: PedidoData
  item: ItemData
  tamanhos: number[]
}

export const TemplatePalmilha = ({ pedido, item, tamanhos }: TemplatePalmilhaProps) => (
  <TemplateSimples
    titulo="PALMILHA"
    pedido={pedido}
    item={item}
    especificacoes={[
      { label: 'REF Palmilha', valor: item.modelo.palmilha },
      { label: 'Cor Palmilha', valor: formatCor(item.variante.corPalmilha, item.variante.corPalmilhaDesc ?? item.variante.corPrincipal) },
      { label: 'Material Palmilha', valor: item.modelo.materialPalmilha },
    ]}
    tamanhos={tamanhos}
    hideSku
  />
)
