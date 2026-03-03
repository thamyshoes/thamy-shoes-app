import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { pdfStyles } from './shared-styles'
import type { GradeRow } from '@/types'
import { Setor } from '@/types'
import { formatDate } from '@/lib/format'

export interface CampoExtraValor {
  nome: string
  tipo: string
  obrigatorio: boolean
}

export interface FichaTemplateProps {
  numeroPedido: string
  dataEmissao: Date
  fornecedor: string
  setor: Setor
  grades: GradeRow[]
  totalPares: number
  camposExtras?: CampoExtraValor[]
  geradoEm: Date
}

const SETOR_LABEL: Record<Setor, string> = {
  CABEDAL: 'Cabedal',
  PALMILHA: 'Palmilha',
  SOLA: 'Sola',
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

  const tamanhoWidth = tamanhos.length > 0 ? Math.max(25, Math.floor(200 / tamanhos.length)) : 25

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
            <Text style={pdfStyles.metaValue}>{totalPares}</Text>
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
            <Text style={[pdfStyles.tableHeaderCell, { width: 120 }]}>Modelo</Text>
            <Text style={[pdfStyles.tableHeaderCell, { width: 80 }]}>Cor</Text>
            {tamanhos.map((t) => (
              <Text key={t} style={[pdfStyles.tableHeaderCell, { width: tamanhoWidth }]}>
                {t}
              </Text>
            ))}
            <Text style={[pdfStyles.tableHeaderCell, { width: 50 }]}>Total</Text>
          </View>

          {/* Table rows */}
          {grades.map((grade, idx) => (
            <View key={idx} style={idx % 2 === 0 ? pdfStyles.tableRow : pdfStyles.tableRowAlt}>
              <Text style={pdfStyles.cellModelo}>{grade.modelo}</Text>
              <Text style={pdfStyles.cellCor}>{grade.corDescricao || grade.cor}</Text>
              {tamanhos.map((t) => (
                <Text key={t} style={[pdfStyles.cellTamanho, { width: tamanhoWidth }]}>
                  {grade.tamanhos[t] ?? '—'}
                </Text>
              ))}
              <Text style={pdfStyles.cellTotal}>{grade.totalPares}</Text>
            </View>
          ))}

          {/* Total row */}
          <View style={pdfStyles.totalRow}>
            <Text style={[pdfStyles.totalLabel, { width: 200 }]}>TOTAL GERAL</Text>
            {tamanhos.map((t) => {
              const soma = grades.reduce((acc, g) => acc + (g.tamanhos[t] ?? 0), 0)
              return (
                <Text key={t} style={[pdfStyles.cellTamanho, { width: tamanhoWidth, color: '#ffffff', fontFamily: 'Helvetica-Bold' }]}>
                  {soma > 0 ? soma : '—'}
                </Text>
              )
            })}
            <Text style={pdfStyles.totalValue}>{totalPares}</Text>
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
          <Text
            style={pdfStyles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
