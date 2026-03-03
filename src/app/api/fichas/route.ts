import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Setor } from '@prisma/client'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  setor: z.nativeEnum(Setor).optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  pedidoId: z.string().optional(),
  search: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const perfil = request.headers.get('x-user-perfil')
  const userSetor = request.headers.get('x-user-setor')

  if (!perfil) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parâmetros inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const { page, pageSize, setor, dataInicio, dataFim, pedidoId, search } = parsed.data

  // PRODUCAO: forçar filtro pelo setor do usuário
  const setorFilter: Setor | undefined =
    perfil === 'PRODUCAO' && userSetor
      ? (userSetor as Setor)
      : setor

  const where: Record<string, unknown> = {}

  if (setorFilter) {
    where.setor = setorFilter
  }

  if (pedidoId) {
    where.pedidoId = pedidoId
  }

  if (dataInicio || dataFim) {
    where.createdAt = {
      ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
      ...(dataFim ? { lte: new Date(`${dataFim}T23:59:59.999Z`) } : {}),
    }
  }

  if (search) {
    where.pedido = {
      OR: [
        { numero: { contains: search, mode: 'insensitive' } },
        { fornecedorNome: { contains: search, mode: 'insensitive' } },
      ],
    }
  }

  const skip = (page - 1) * pageSize

  const [fichas, total] = await Promise.all([
    prisma.fichaProducao.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        pedido: {
          select: { numero: true, fornecedorNome: true },
        },
        consolidado: {
          select: {
            id: true,
            pedidos: {
              select: { pedido: { select: { numero: true } } },
            },
          },
        },
      },
    }),
    prisma.fichaProducao.count({ where }),
  ])

  return NextResponse.json({
    data: fichas,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
