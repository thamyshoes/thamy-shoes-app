/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { h } from '@/lib/pdf/h-factory'
import { TemplateSimples } from './template-simples'
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
      { label: 'Material Palmilha', valor: item.modelo.materialPalmilha },
      { label: 'Cor Palmilha', valor: item.variante.corPalmilha ?? item.variante.corPrincipal },
      { label: 'Cor Principal', valor: item.variante.corPrincipal },
    ]}
    tamanhos={tamanhos}
  />
)
