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
    justifyContent: 'flex-start',
    gap: 4,
    fontFamily: PDF_TOKENS.fontFamily.default,
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
  cardsPerPage?: number
}

// 5 cards por página, distribuidos com space-between
export const PageLayout = ({ cards, cardsPerPage = 5 }: PageLayoutProps) => {
  const pages = chunk(cards, cardsPerPage)

  return (
    <Document>
      {pages.map((pageCards, pi) => (
        <Page key={String(pi)} size="A4" style={styles.page}>
          {pageCards.map((card, ci) => (
            <View key={String(ci)}>{card}</View>
          ))}
        </Page>
      ))}
    </Document>
  )
}
