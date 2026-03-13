import path from 'node:path'
import { Font, StyleSheet } from '@react-pdf/renderer'

const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontsDir, 'Inter-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(fontsDir, 'Inter-Bold.ttf'), fontWeight: 'bold' },
  ],
})

Font.register({
  family: 'JetBrainsMono',
  fonts: [{ src: path.join(fontsDir, 'JetBrainsMono-Regular.ttf') }],
})

export const PDF_TOKENS = {
  page: { width: 210, height: 297, unit: 'mm' as const, margin: 10 },
  card: { height: 67, gap: 2 }, // mm — 4*67 + 3*2 = 274mm < 277mm disponível ✓
  colors: {
    black: '#000000',
    white: '#FFFFFF',
    border: '#E2E8F0',
    text: '#1A1A1A',
    muted: '#64748B',
  },
  fontSize: { xs: 7, sm: 8, md: 9, lg: 11, xl: 13 },
  fontFamily: {
    default: 'Inter',
    mono: 'JetBrainsMono',
  },
} as const

// Estilos compartilhados entre componentes PDF
export const pdfBaseStyles = StyleSheet.create({
  titulo: {
    fontSize: PDF_TOKENS.fontSize.md,
    fontFamily: PDF_TOKENS.fontFamily.default,
    fontWeight: 'bold',
    color: PDF_TOKENS.colors.text,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  labelText: {
    fontSize: PDF_TOKENS.fontSize.xs,
    fontFamily: PDF_TOKENS.fontFamily.default,
    color: PDF_TOKENS.colors.muted,
  },
  valueText: {
    fontSize: PDF_TOKENS.fontSize.sm,
    fontFamily: PDF_TOKENS.fontFamily.default,
    color: PDF_TOKENS.colors.text,
  },
})
