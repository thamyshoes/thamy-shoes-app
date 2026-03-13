/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { Page, Document, View, StyleSheet } from '@react-pdf/renderer'
import { h } from '@/lib/pdf/h-factory'
import { PDF_TOKENS } from '@/lib/pdf-tokens'

const styles = StyleSheet.create({
  page: {
    padding: PDF_TOKENS.page.margin,
    flexDirection: 'column',
    gap: PDF_TOKENS.card.gap,
    fontFamily: PDF_TOKENS.fontFamily.default,
  },
  row: {
    flexDirection: 'row',
    gap: PDF_TOKENS.card.gap,
    flex: 1,
  },
})

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

interface PageLayoutProps {
  cards: any[]
}

// Distribui cards em grupos de 2 por linha, 2 linhas por página (4/página)
export const PageLayout = ({ cards }: PageLayoutProps) => {
  const pages = chunk(cards, 4)

  return (
    <Document>
      {pages.map((pageCards, pi) => (
        <Page key={String(pi)} size="A4" style={styles.page}>
          <View style={styles.row}>{pageCards.slice(0, 2)}</View>
          <View style={styles.row}>{pageCards.slice(2, 4)}</View>
        </Page>
      ))}
    </Document>
  )
}
