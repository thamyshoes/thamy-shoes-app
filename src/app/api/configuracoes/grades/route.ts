import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP } from '@/lib/api-guard'

const createSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  tamanhoMin: z.number().int().min(1, 'Tamanho mínimo deve ser >= 1'),
  tamanhoMax: z.number().int().min(1, 'Tamanho máximo deve ser >= 1'),
}).refine((d) => d.tamanhoMin < d.tamanhoMax, {
  message: 'Tamanho mínimo deve ser menor que o máximo',
  path: ['tamanhoMin'],
})

export async function GET(request: NextRequest) {
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  const grades = await prisma.gradeNumeracao.findMany({
    orderBy: { nome: 'asc' },
    include: { modelos: { orderBy: { modelo: 'asc' } } },
  })

  return NextResponse.json(grades)
}

export async function POST(request: NextRequest) {
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const grade = await prisma.gradeNumeracao.create({ data: parsed.data })
  return NextResponse.json(grade, { status: 201 })
}
