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
import type { PedidoData, ItemData } from '../pdf-types'

const styles = StyleSheet.create({
  identificacao: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 3,
  },
  col1: {
    flex: 2,
    gap: 1,
  },
  col2: {
    flex: 2,
    gap: 1,
  },
  col3: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagem: {
    width: 40,
    height: 40,
    objectFit: 'contain',
  },
  imagemVazia: {
    width: 40,
    height: 40,
    border: `0.5pt dashed ${PDF_TOKENS.colors.border}`,
    backgroundColor: '#F8FAFC',
  },
  especificacoes: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  specCol: {
    flex: 1,
    gap: 1,
  },
})

interface TemplateCabedalProps {
  pedido: PedidoData
  item: ItemData
  base64Imagem: string | null
  tamanhos: number[]
}

export const TemplateCabedal = ({ pedido, item, base64Imagem, tamanhos }: TemplateCabedalProps) => (
  <FichaCard>
    {/* Título do setor */}
    <Text style={pdfBaseStyles.titulo}>CABEDAL</Text>

    {/* Bloco identificação: 3 colunas */}
    <View style={styles.identificacao}>
      <View style={styles.col1}>
        <Text style={pdfBaseStyles.labelText}>Pedido</Text>
        <Text style={pdfBaseStyles.valueText}>{pedido.numero}</Text>
        <Text style={pdfBaseStyles.labelText}>Modelo</Text>
        <Text style={pdfBaseStyles.valueText}>{item.modelo.codigo ?? '-'}</Text>
      </View>
      <View style={styles.col2}>
        <Text style={pdfBaseStyles.labelText}>Data</Text>
        <Text style={pdfBaseStyles.valueText}>{formatDate(pedido.data)}</Text>
        <Text style={pdfBaseStyles.labelText}>SKU</Text>
        <Text style={pdfBaseStyles.valueText}>{item.sku}</Text>
      </View>
      <View style={styles.col3}>
        {base64Imagem ? (
          <Image src={base64Imagem} style={styles.imagem} />
        ) : (
          <View style={styles.imagemVazia} />
        )}
      </View>
    </View>

    {/* Especificações */}
    <View style={styles.especificacoes}>
      <View style={styles.specCol}>
        <Text style={pdfBaseStyles.labelText}>Material Cabedal</Text>
        <Text style={pdfBaseStyles.valueText}>{item.modelo.materialCabedal ?? '-'}</Text>
      </View>
      <View style={styles.specCol}>
        <Text style={pdfBaseStyles.labelText}>Cor Cabedal</Text>
        <Text style={pdfBaseStyles.valueText}>
          {item.variante.corCabedal ?? item.variante.corPrincipal}
        </Text>
      </View>
      <View style={styles.specCol}>
        <Text style={pdfBaseStyles.labelText}>Cor Principal</Text>
        <Text style={pdfBaseStyles.valueText}>{item.variante.corPrincipal}</Text>
      </View>
    </View>

    {/* Grade de numeração */}
    <GradeNumeracao tamanhos={tamanhos} quantidades={item.quantidades} />
  </FichaCard>
)
