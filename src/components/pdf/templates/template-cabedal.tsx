/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { h } from '@/lib/pdf/h-factory'
import { FichaCard } from '../ficha-card'
import { GradeNumeracao } from '../grade-numeracao'
import { PDF_TOKENS, pdfBaseStyles } from '@/lib/pdf-tokens'
import { formatDate } from '@/lib/format'
import { formatCor } from '../pdf-types'
import type { PedidoData, ItemData } from '../pdf-types'

const styles = StyleSheet.create({
  // Row com 3 colunas: col1 | col2 | col3(imagem)
  row3col: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  col: {
    flex: 1,
    gap: 1,
  },
  colImagem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagem: {
    width: 46,
    height: 46,
    objectFit: 'contain',
  },
  imagemVazia: {
    width: 46,
    height: 46,
    border: `0.5pt dashed ${PDF_TOKENS.colors.border}`,
    backgroundColor: '#F8FAFC',
  },
  // Inline field: "Label: Valor" na mesma linha
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

interface TemplateCabedalProps {
  pedido: PedidoData
  item: ItemData
  base64Imagem: string | null
  tamanhos: number[]
}

export const TemplateCabedal = ({ pedido, item, base64Imagem, tamanhos }: TemplateCabedalProps) => (
  <FichaCard>
    {/* Titulo */}
    <Text style={pdfBaseStyles.titulo}>CABEDAL</Text>

    {/* Identificacao: 3 colunas alinhadas */}
    <View style={[styles.row3col, { marginBottom: 0 }]}>
      <View style={styles.col}>
        <Field label="Pedido" value={String(pedido.numero)} />
        <Field label="Data" value={formatDate(pedido.data)} />
      </View>
      <View style={styles.col}>
        <Field label="SKU" value={item.sku} />
        <Field label="Fornecedor" value={pedido.fornecedor} />
      </View>
      <View style={styles.colImagem}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {base64Imagem ? (
          <Image src={base64Imagem} style={styles.imagem} />
        ) : (
          <View style={styles.imagemVazia} />
        )}
      </View>
    </View>

    {/* Especificacoes: 3 colunas alinhadas com imagem acima */}
    <View style={styles.row3col}>
      <View style={styles.col}>
        <Field label="REF Cabedal" value={item.modelo.cabedal ?? '-'} />
        <Field label="REF Sola" value={item.modelo.sola ?? '-'} />
        <Field label="Cor Sola" value={formatCor(item.variante.corSola, item.variante.corSolaDesc ?? item.variante.corPrincipal)} />
      </View>
      <View style={styles.col}>
        <Field label="Cor Cabedal" value={formatCor(item.variante.corCabedal, item.variante.corCabedalDesc ?? item.variante.corPrincipal)} />
        <Field label="REF Palmilha" value={item.modelo.palmilha ?? '-'} />
        <Field label="Cor Palmilha" value={formatCor(item.variante.corPalmilha, item.variante.corPalmilhaDesc ?? item.variante.corPrincipal)} />
      </View>
      <View style={styles.col}>
        <Field label="Material Cabedal" value={item.modelo.materialCabedal ?? '-'} />
      </View>
    </View>

    {/* Grade */}
    <GradeNumeracao tamanhos={tamanhos} quantidades={item.quantidades} />

    {/* Observacao */}
    <View style={{ marginTop: 4, borderTop: `0.5pt solid ${PDF_TOKENS.colors.border}`, paddingTop: 3 }}>
      <Text style={{ fontSize: PDF_TOKENS.fontSize.xs, fontFamily: PDF_TOKENS.fontFamily.default, fontWeight: 'bold', color: PDF_TOKENS.colors.text }}>Observação:</Text>
    </View>
  </FichaCard>
)
