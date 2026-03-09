import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

interface LinhaParseada {
  codigo: string
  nome: string
  cabedal: string | null
  sola: string | null
  palmilha: string | null
  linha: string | null
  observacoes: string | null
}

function parseLinha(linha: string, idx: number): { data: LinhaParseada } | { erro: string } {
  const sep = linha.includes(';') ? ';' : ','
  const partes = linha.split(sep).map((p) => p.trim())

  const codigo = partes[0]
  const nome = partes[1]

  if (!codigo || !nome) {
    return { erro: `Linha ${idx + 1}: código e nome são obrigatórios` }
  }

  return {
    data: {
      codigo,
      nome,
      cabedal: partes[2] || null,
      sola: partes[3] || null,
      palmilha: partes[4] || null,
      linha: partes[5] || null,
      observacoes: partes[6] || null,
    },
  }
}

// POST /api/configuracoes/modelos/bulk-import
export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const dados = (body as { dados?: string }).dados
  if (!dados || typeof dados !== 'string') {
    return NextResponse.json({ error: 'Campo "dados" obrigatório' }, { status: 400 })
  }

  const linhas = dados.split('\n').map((l) => l.trim()).filter(Boolean)
  if (linhas.length === 0) {
    return NextResponse.json({ error: 'Nenhuma linha encontrada' }, { status: 400 })
  }

  const erros: string[] = []
  const validas: LinhaParseada[] = []

  for (let i = 0; i < linhas.length; i++) {
    const result = parseLinha(linhas[i]!, i)
    if ('erro' in result) {
      erros.push(result.erro)
    } else {
      validas.push(result.data)
    }
  }

  if (validas.length === 0) {
    return NextResponse.json({ error: 'Nenhuma linha válida', erros }, { status: 422 })
  }

  let criados = 0
  let atualizados = 0

  for (const linha of validas) {
    const existing = await prisma.modelo.findUnique({ where: { codigo: linha.codigo } })
    if (existing) {
      await prisma.modelo.update({
        where: { codigo: linha.codigo },
        data: {
          nome: linha.nome,
          cabedal: linha.cabedal,
          sola: linha.sola,
          palmilha: linha.palmilha,
          linha: linha.linha,
          observacoes: linha.observacoes,
        },
      })
      atualizados++
    } else {
      await prisma.modelo.create({ data: linha })
      criados++
    }
  }

  return NextResponse.json({ criados, atualizados, erros })
}
