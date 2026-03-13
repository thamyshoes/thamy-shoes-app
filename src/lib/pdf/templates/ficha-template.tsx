/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @jsxRuntime classic
 * @jsx h
 */
import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { pdfStyles } from './shared-styles'
import type { GradeRow } from '@/types'
import { Setor } from '@/types'
import { formatDate } from '@/lib/format'

/**
 * Custom JSX factory que cria elementos com Symbol(react.element) (React 18).
 * Necessário porque Next.js 15 usa React 19 canary (Symbol(react.transitional.element))
 * mas @react-pdf/renderer v3.4 espera React 18 elements.
 */
const REACT_ELEMENT_TYPE = Symbol.for('react.element')
function h(type: any, props: any, ...children: any[]): any {
  const { key, ref, ...rest } = props || {}
  const flatChildren = children.length === 0
    ? undefined
    : children.length === 1
      ? children[0]
      : children
  return {
    '$$typeof': REACT_ELEMENT_TYPE,
    type,
    key: key ?? null,
    ref: ref ?? null,
    props: flatChildren !== undefined ? { ...rest, children: flatChildren } : { ...rest },
  }
}

export interface CampoExtraValor {
  nome: string
  tipo: string
  obrigatorio: boolean
}

export interface GradeRowComImagem extends GradeRow {
  imagemBase64?: string
}

export interface FichaTemplateProps {
  numeroPedido: string
  dataEmissao: Date
  fornecedor: string
  setor: Setor
  grades: (GradeRow | GradeRowComImagem)[]
  totalPares: number
  camposExtras?: CampoExtraValor[]
  geradoEm: Date
}

const SETOR_LABEL: Record<Setor, string> = {
  CABEDAL:  'Cabedal',
  PALMILHA: 'Palmilha',
  SOLA:     'Sola',
  FACHETA:  'Facheta',
}

function getEspecificacao(grade: GradeRow, setor: Setor): string | undefined {
  if (setor === Setor.CABEDAL)  return grade.modeloCabedal  ?? undefined
  if (setor === Setor.SOLA)     return grade.modeloSola     ?? undefined
  if (setor === Setor.PALMILHA) return grade.modeloPalmilha ?? undefined
  if (setor === Setor.FACHETA)  return grade.modeloFacheta  ?? undefined
  return undefined
}

/** Retorna info extra por cor para exibir na ficha de produção */
function getInfoExtra(grade: GradeRow, setor: Setor): string | undefined {
  if (setor === Setor.CABEDAL) {
    const partes: string[] = []
    if (grade.materialCabedal) partes.push(`Material: ${grade.materialCabedal}`)
    if (grade.corCabedal) partes.push(`Cor: ${grade.corCabedal}`)
    return partes.length > 0 ? partes.join(' | ') : undefined
  }
  if (setor === Setor.SOLA) {
    const partes: string[] = []
    if (grade.materialSola) partes.push(`Material: ${grade.materialSola}`)
    if (grade.corSola) partes.push(`Cor: ${grade.corSola}`)
    if (grade.corFacheta) partes.push(`Facheta: ${grade.corFacheta}`)
    return partes.length > 0 ? partes.join(' | ') : undefined
  }
  if (setor === Setor.PALMILHA) {
    const partes: string[] = []
    if (grade.materialPalmilha) partes.push(`Material: ${grade.materialPalmilha}`)
    if (grade.corPalmilha) partes.push(`Cor: ${grade.corPalmilha}`)
    return partes.length > 0 ? partes.join(' | ') : undefined
  }
  if (setor === Setor.FACHETA) {
    const partes: string[] = []
    if (grade.materialFacheta) partes.push(`Material: ${grade.materialFacheta}`)
    if (grade.corFacheta) partes.push(`Cor: ${grade.corFacheta}`)
    return partes.length > 0 ? partes.join(' | ') : undefined
  }
  return undefined
}

function getSortedTamanhos(grades: GradeRow[]): string[] {
  const all = new Set<string>()
  grades.forEach((g) => Object.keys(g.tamanhos).forEach((t) => all.add(t)))
  return Array.from(all).sort((a, b) => {
    const na = parseFloat(a)
    const nb = parseFloat(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })
}

export function FichaTemplate({
  numeroPedido,
  dataEmissao,
  fornecedor,
  setor,
  grades,
  totalPares,
  camposExtras = [],
  geradoEm,
}: FichaTemplateProps) {
  const tamanhos = getSortedTamanhos(grades)

  const tamanhoWidth = tamanhos.length > 0 ? Math.max(25, Math.floor(160 / tamanhos.length)) : 25
  const hasEspec = grades.some((g) => !!getEspecificacao(g, setor))
  const hasExtra = grades.some((g) => !!getInfoExtra(g, setor))
  const hasImagem = setor === Setor.CABEDAL && grades.some((g) => 'imagemBase64' in g && !!(g as GradeRowComImagem).imagemBase64)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.headerTitle}>Ficha de Produção — {SETOR_LABEL[setor]}</Text>
          <Text style={pdfStyles.headerSetor}>Thamy Shoes</Text>
        </View>

        {/* Meta info */}
        <View style={pdfStyles.metaSection}>
          <View style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>Pedido:</Text>
            <Text style={pdfStyles.metaValue}>{numeroPedido}</Text>
            <Text style={pdfStyles.metaLabel}>Fornecedor:</Text>
            <Text style={pdfStyles.metaValue}>{fornecedor}</Text>
          </View>
          <View style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>Data Emissão:</Text>
            <Text style={pdfStyles.metaValue}>{formatDate(dataEmissao)}</Text>
            <Text style={pdfStyles.metaLabel}>Total de Pares:</Text>
            <Text style={pdfStyles.metaValue}>{String(totalPares)}</Text>
          </View>
          <View style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>Setor:</Text>
            <Text style={pdfStyles.metaValue}>{SETOR_LABEL[setor]}</Text>
          </View>
        </View>

        {/* Grade table */}
        <View style={pdfStyles.tableContainer}>
          {/* Table header */}
          <View style={pdfStyles.tableHeader}>
            {hasImagem && (
              <Text style={[pdfStyles.tableHeaderCell, { width: 45 }]}>Img</Text>
            )}
            <Text style={[pdfStyles.tableHeaderCell, { width: 110 }]}>Modelo</Text>
            {hasEspec && (
              <Text style={[pdfStyles.tableHeaderCell, { width: 90 }]}>{SETOR_LABEL[setor]}</Text>
            )}
            <Text style={[pdfStyles.tableHeaderCell, { width: 80 }]}>Cor</Text>
            {hasExtra && (
              <Text style={[pdfStyles.tableHeaderCell, { width: 100 }]}>Detalhes</Text>
            )}
            {tamanhos.map((t) => (
              <Text key={t} style={[pdfStyles.tableHeaderCell, { width: tamanhoWidth }]}>
                {t}
              </Text>
            ))}
            <Text style={[pdfStyles.tableHeaderCell, { width: 50 }]}>Total</Text>
          </View>

          {/* Table rows */}
          {grades.map((grade, idx) => {
            const espec = getEspecificacao(grade, setor)
            const extra = getInfoExtra(grade, setor)
            const imgBase64 = 'imagemBase64' in grade ? (grade as GradeRowComImagem).imagemBase64 : undefined
            return (
              <View key={idx} style={idx % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt}>
                {hasImagem && (
                  <View style={{ width: 45, paddingHorizontal: 2, justifyContent: 'center', alignItems: 'center' }}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    {imgBase64 ? (
                      <Image src={imgBase64} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                    ) : (
                      <Text style={{ fontSize: 6, color: '#9CA3AF' }}>—</Text>
                    )}
                  </View>
                )}
                <View style={{ width: 110, paddingHorizontal: 4, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 8, color: '#111827' }}>
                    {grade.modeloNome ? `${grade.modelo} — ${grade.modeloNome}` : grade.modelo}
                  </Text>
                </View>
                {hasEspec && (
                  <Text style={[pdfStyles.cellCor, { width: 90 }]}>{espec ?? '—'}</Text>
                )}
                <Text style={pdfStyles.cellCor}>{grade.corDescricao || grade.cor}</Text>
                {hasExtra && (
                  <Text style={[pdfStyles.cellCor, { width: 100, fontSize: 6 }]}>{extra ?? '—'}</Text>
                )}
                {tamanhos.map((t) => (
                  <Text key={t} style={[pdfStyles.cellTamanho, { width: tamanhoWidth }]}>
                    {grade.tamanhos[t] != null ? String(grade.tamanhos[t]) : '—'}
                  </Text>
                ))}
                <Text style={pdfStyles.cellTotal}>{String(grade.totalPares)}</Text>
              </View>
            )
          })}

          {/* Total row */}
          <View style={pdfStyles.totalRow}>
            <Text style={{
              width: (hasEspec ? 280 : 190) + (hasExtra ? 100 : 0) + (hasImagem ? 45 : 0),
              fontSize: 9,
              fontFamily: 'Helvetica-Bold',
              color: '#ffffff',
            }}>TOTAL GERAL</Text>
            {tamanhos.map((t) => {
              const soma = grades.reduce((acc, g) => acc + (g.tamanhos[t] ?? 0), 0)
              return (
                <Text key={t} style={[pdfStyles.cellTamanho, { width: tamanhoWidth, color: '#ffffff', fontFamily: 'Helvetica-Bold' }]}>
                  {soma > 0 ? String(soma) : '—'}
                </Text>
              )
            })}
            <Text style={pdfStyles.totalValue}>{String(totalPares)}</Text>
          </View>
        </View>

        {/* Campos extras */}
        {camposExtras.length > 0 && (
          <View style={pdfStyles.camposExtrasSection}>
            <Text style={pdfStyles.camposExtrasTitle}>Campos Adicionais</Text>
            {camposExtras.map((campo, idx) => (
              <View key={idx} style={pdfStyles.campoRow}>
                <Text style={pdfStyles.campoLabel}>
                  {campo.nome}
                  {campo.obrigatorio ? ' *' : ''}:
                </Text>
                <Text style={pdfStyles.campoValue}> </Text>
              </View>
            ))}
          </View>
        )}

        {/* Signatures */}
        <View style={pdfStyles.signatureSection}>
          <View style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureLabel}>Responsável de Produção</Text>
          </View>
          <View style={pdfStyles.signatureBox}>
            <Text style={pdfStyles.signatureLabel}>Conferência / Data</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={pdfStyles.footer} fixed>
          <Text style={pdfStyles.footerText}>
            Gerado em {formatDate(geradoEm)} — Thamy Shoes
          </Text>
          <Text style={pdfStyles.footerText}>
            {`Página 1 de 1`}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
