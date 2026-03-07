import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const createSchema = z.object({
  codigo: z.string().min(1).max(30),
  nome: z.string().min(1, 'Nome é obrigatório'),
  sola: z.string().optional(),
  palmilha: z.string().optional(),
  observacoes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const search = request.nextUrl.searchParams.get('search') ?? ''
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('pageSize') ?? '50', 10)))

  const where = search
    ? {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' as const } },
          { nome: { contains: search, mode: 'insensitive' as const } },
          { sola: { contains: search, mode: 'insensitive' as const } },
          { palmilha: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [modelos, total] = await Promise.all([
    prisma.modelo.findMany({
      where,
      orderBy: { codigo: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.modelo.count({ where }),
  ])

  return NextResponse.json({ items: modelos, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
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
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const { codigo, nome, sola, palmilha, observacoes } = parsed.data

  const existing = await prisma.modelo.findUnique({ where: { codigo } })
  if (existing) {
    return NextResponse.json({ error: `Modelo "${codigo}" já cadastrado` }, { status: 409 })
  }

  const modelo = await prisma.modelo.create({
    data: { codigo, nome, sola: sola ?? null, palmilha: palmilha ?? null, observacoes: observacoes ?? null },
  })

  return NextResponse.json(modelo, { status: 201 })
}
