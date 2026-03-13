/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { h } from '@/lib/pdf/h-factory'
import { PDF_TOKENS } from '@/lib/pdf-tokens'

const styles = StyleSheet.create({
  table: {
    border: `1pt solid ${PDF_TOKENS.colors.black}`,
    marginTop: 3,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: PDF_TOKENS.colors.black,
  },
  bodyRow: {
    flexDirection: 'row',
    backgroundColor: PDF_TOKENS.colors.white,
  },
  cell: {
    flex: 1,
    padding: 2,
    textAlign: 'center',
    borderRight: `0.5pt solid ${PDF_TOKENS.colors.black}`,
  },
  cellLast: {
    flex: 1,
    padding: 2,
    textAlign: 'center',
  },
  headerText: {
    color: PDF_TOKENS.colors.white,
    fontSize: PDF_TOKENS.fontSize.xs,
    fontFamily: PDF_TOKENS.fontFamily.mono,
  },
  bodyText: {
    color: PDF_TOKENS.colors.black,
    fontSize: PDF_TOKENS.fontSize.xs,
    fontFamily: PDF_TOKENS.fontFamily.mono,
  },
})

interface GradeNumeracaoProps {
  tamanhos: number[]
  quantidades: Record<number, number>
}

export const GradeNumeracao = ({ tamanhos, quantidades }: GradeNumeracaoProps) => {
  if (tamanhos.length === 0) {
    return (
      <View style={styles.table}>
        <View style={styles.headerRow} />
        <View style={styles.bodyRow} />
      </View>
    )
  }

  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        {tamanhos.map((t, i) => (
          <View key={t} style={i === tamanhos.length - 1 ? styles.cellLast : styles.cell}>
            <Text style={styles.headerText}>{String(t)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.bodyRow}>
        {tamanhos.map((t, i) => (
          <View key={t} style={i === tamanhos.length - 1 ? styles.cellLast : styles.cell}>
            <Text style={styles.bodyText}>{String(quantidades[t] ?? '')}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
