import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const bulkSchema = z.object({
  dados: z.string().min(1, 'Dados CSV são obrigatórios'),
})

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const linhas = parsed.data.dados
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  let criados = 0
  let atualizados = 0
  const erros: string[] = []

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    const partes = linha.includes(';') ? linha.split(';') : linha.split(',')
    if (partes.length < 2 || !partes[0]?.trim() || !partes[1]?.trim()) {
      erros.push(`Linha ${i + 1}: formato inválido`)
      continue
    }

    const codigo = partes[0].trim().toUpperCase()
    const descricao = partes[1].trim()

    const existing = await prisma.mapeamentoCor.findUnique({ where: { codigo } })
    if (existing) {
      await prisma.mapeamentoCor.update({ where: { codigo }, data: { descricao } })
      atualizados++
    } else {
      await prisma.mapeamentoCor.create({ data: { codigo, descricao } })
      criados++
    }
  }

  return NextResponse.json({ criados, atualizados, erros })
}
