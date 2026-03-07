import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
})

// GET /api/produtos?page=1&pageSize=20&search=...
// Admin only — protected by middleware
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 422 })
  }

  const { page, pageSize, search } = parsed.data

  const where = search
    ? {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' as const } },
          { nome: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [produtos, total] = await Promise.all([
    prisma.produto.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { codigo: 'asc' },
      include: {
        _count: { select: { itens: true } },
      },
    }),
    prisma.produto.count({ where }),
  ])

  const data = produtos.map(({ _count, idBling, ...p }) => ({
    ...p,
    idBling: idBling.toString(),
    totalItens: _count.itens,
  }))

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
