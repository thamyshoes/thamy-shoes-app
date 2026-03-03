import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const createSchema = z.object({
  codigo: z.string().min(1).regex(/^[A-Z0-9]+$/, 'Código deve ser alfanumérico maiúsculo'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
})

export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const search = request.nextUrl.searchParams.get('search') ?? ''

  const where = search
    ? {
        OR: [
          { codigo: { contains: search.toUpperCase(), mode: 'insensitive' as const } },
          { descricao: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const cores = await prisma.mapeamentoCor.findMany({
    where,
    orderBy: { codigo: 'asc' },
  })

  return NextResponse.json(cores)
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
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

  const { codigo, descricao } = parsed.data

  const existing = await prisma.mapeamentoCor.findUnique({ where: { codigo } })
  if (existing) {
    return NextResponse.json({ error: 'Código de cor já cadastrado' }, { status: 409 })
  }

  const cor = await prisma.mapeamentoCor.create({ data: { codigo, descricao } })
  return NextResponse.json(cor, { status: 201 })
}
