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
  row2col: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  col: {
    flex: 1,
    gap: 1,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 2,
  },
  fieldLabel: {
    fontSize: PDF_TOKENS.fontSize.xs,
    fontFamily: PDF_TOKENS.fontFamily.default,
    color: PDF_TOKENS.colors.muted,
  },
  fieldValue: {
    fontSize: PDF_TOKENS.fontSize.xs,
    fontFamily: PDF_TOKENS.fontFamily.default,
    color: PDF_TOKENS.colors.text,
    fontWeight: 'bold',
  },
})

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

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
    <Text style={pdfBaseStyles.titulo}>{titulo}</Text>

    {/* Identificacao inline */}
    <View style={styles.row2col}>
      <View style={styles.col}>
        <Field label="Pedido" value={String(pedido.numero)} />
      </View>
      <View style={styles.col}>
        <Field label="Data" value={formatDate(pedido.data)} />
        <Field label="SKU" value={item.sku} />
      </View>
    </View>

    {/* Especificacoes inline */}
    <View style={styles.specsRow}>
      <View style={styles.col}>
        {especificacoes.map(({ label, valor }) => (
          <Field key={label} label={label} value={valor ?? '-'} />
        ))}
      </View>
    </View>

    {/* Grade */}
    <GradeNumeracao tamanhos={tamanhos} quantidades={item.quantidades} />

    {/* Observacao */}
    <View style={{ marginTop: 4, borderTop: '0.5pt solid #d4d4d4', paddingTop: 3 }}>
      <Text style={styles.fieldLabel}><Text style={{ fontWeight: 'bold', color: PDF_TOKENS.colors.text }}>Observação:</Text></Text>
    </View>
  </FichaCard>
)
