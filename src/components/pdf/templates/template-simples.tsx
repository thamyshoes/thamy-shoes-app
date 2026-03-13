/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { h } from '@/lib/pdf/h-factory'
import { FichaCard } from '../ficha-card'
import { GradeNumeracao } from '../grade-numeracao'
import { PDF_TOKENS, pdfBaseStyles } from '@/lib/pdf-tokens'
import { formatDate } from '@/lib/format'
import type { PedidoData, ItemData } from '../pdf-types'

const styles = StyleSheet.create({
  identificacao2col: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  col: {
    flex: 1,
    gap: 3,
  },
  especificacoes: {
    gap: 4,
    marginBottom: 8,
  },
  specRow: {
    flexDirection: 'row',
    gap: 8,
  },
  specLabel: {
    fontSize: PDF_TOKENS.fontSize.xs,
    color: PDF_TOKENS.colors.muted,
    width: 100,
  },
  specValue: {
    fontSize: PDF_TOKENS.fontSize.sm,
    color: PDF_TOKENS.colors.text,
    flex: 1,
  },
})

interface EspecificacaoItem {
  label: string
  valor: string | null | undefined
}

interface TemplateSimplesProps {
  titulo: string
  pedido: PedidoData
  item: ItemData
  especificacoes: EspecificacaoItem[]
  tamanhos: number[]
}

export const TemplateSimples = ({
  titulo,
  pedido,
  item,
  especificacoes,
  tamanhos,
}: TemplateSimplesProps) => (
  <FichaCard>
    {/* Título do setor */}
    <Text style={pdfBaseStyles.titulo}>{titulo}</Text>

    {/* Bloco identificação: 2 colunas (sem imagem) */}
    <View style={styles.identificacao2col}>
      <View style={styles.col}>
        <Text style={pdfBaseStyles.labelText}>Pedido</Text>
        <Text style={pdfBaseStyles.valueText}>{pedido.numero}</Text>
        <Text style={pdfBaseStyles.labelText}>Setor</Text>
        <Text style={pdfBaseStyles.valueText}>{titulo}</Text>
      </View>
      <View style={styles.col}>
        <Text style={pdfBaseStyles.labelText}>Data</Text>
        <Text style={pdfBaseStyles.valueText}>{formatDate(pedido.data)}</Text>
        <Text style={pdfBaseStyles.labelText}>SKU</Text>
        <Text style={pdfBaseStyles.valueText}>{item.sku}</Text>
      </View>
    </View>

    {/* Especificações */}
    <View style={styles.especificacoes}>
      {especificacoes.map(({ label, valor }) => (
        <View key={label} style={styles.specRow}>
          <Text style={styles.specLabel}>{label}</Text>
          <Text style={styles.specValue}>{valor ?? '-'}</Text>
        </View>
      ))}
    </View>

    {/* Grade de numeração */}
    <GradeNumeracao tamanhos={tamanhos} quantidades={item.quantidades} />
  </FichaCard>
)
