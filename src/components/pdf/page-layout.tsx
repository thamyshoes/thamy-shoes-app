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
    padding: 14,
    flexDirection: 'column',
    gap: 6,
    fontFamily: PDF_TOKENS.fontFamily.default,
  },
  cardWrapper: {
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

// 4 cards por página, 1 por linha (cada card = 1/4 da página, largura total)
export const PageLayout = ({ cards }: PageLayoutProps) => {
  const pages = chunk(cards, 4)

  return (
    <Document>
      {pages.map((pageCards, pi) => (
        <Page key={String(pi)} size="A4" style={styles.page}>
          {pageCards.map((card, ci) => (
            <View key={String(ci)} style={styles.cardWrapper}>{card}</View>
          ))}
        </Page>
      ))}
    </Document>
  )
}
