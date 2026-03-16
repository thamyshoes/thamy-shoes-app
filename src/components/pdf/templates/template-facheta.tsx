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
import { formatCor } from '../pdf-types'
import type { PedidoData, ItemData } from '../pdf-types'

interface TemplateFachetaProps {
  pedido: PedidoData
  item: ItemData
  tamanhos: number[]
}

const styles = StyleSheet.create({
  row3col: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  col: {
    flex: 1,
    gap: 1,
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

export const TemplateFacheta = ({ pedido, item, tamanhos }: TemplateFachetaProps) => {
  if (!item.modelo.facheta) return null

  const corFacheta = formatCor(item.variante.corFacheta, item.variante.corFachetaDesc ?? item.variante.corPrincipal)
  const corSola = formatCor(item.variante.corSola, item.variante.corSolaDesc ?? item.variante.corPrincipal)

  return (
    <FichaCard>
      <Text style={pdfBaseStyles.titulo}>FACHETA</Text>

      {/* Todos os campos em uma única div com 3 colunas balanceadas */}
      <View style={styles.row3col}>
        <View style={styles.col}>
          <Field label="Pedido"    value={String(pedido.numero)} />
          <Field label="Fornecedor" value={pedido.fornecedor} />
          <Field label="Data"      value={formatDate(pedido.data)} />
        </View>
        <View style={styles.col}>
          <Field label="REF Facheta"      value={item.modelo.facheta} />
          <Field label="Cor Facheta"      value={corFacheta} />
          <Field label="Material Facheta" value={item.modelo.materialFacheta ?? '-'} />
        </View>
        <View style={styles.col}>
          <Field label="REF Sola" value={item.modelo.sola ?? '-'} />
          <Field label="Cor Sola" value={corSola} />
        </View>
      </View>

      {/* Grade */}
      <GradeNumeracao tamanhos={tamanhos} quantidades={item.quantidades} />

      {/* Observacao */}
      <View style={{ marginTop: 4, borderTop: '0.5pt solid #d4d4d4', paddingTop: 3 }}>
        <Text style={styles.fieldLabel}>
          <Text style={{ fontWeight: 'bold', color: PDF_TOKENS.colors.text }}>Observação:</Text>
        </Text>
      </View>
    </FichaCard>
  )
}
