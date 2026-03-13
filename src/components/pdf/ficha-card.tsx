/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { View, StyleSheet } from '@react-pdf/renderer'
import { h } from '@/lib/pdf/h-factory'
import { PDF_TOKENS } from '@/lib/pdf-tokens'

const styles = StyleSheet.create({
  card: {
    padding: 5,
    border: `1pt solid ${PDF_TOKENS.colors.border}`,
    flexDirection: 'column',
  },
})

export const FichaCard = ({ children }: { children: any }) => (
  <View style={styles.card}>{children}</View>
)
