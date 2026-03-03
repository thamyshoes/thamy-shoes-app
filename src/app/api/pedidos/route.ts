import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { paginationSchema } from '@/lib/validators'
import { parseDateBrEnd, parseDateBrStart } from '@/lib/format'
import { StatusPedido, StatusItem } from '@/types'

const listQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(StatusPedido).optional(),
  fornecedor: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  search: z.string().optional(),
})

// GET /api/pedidos
// Auth: ADMIN, PCP — protected by middleware
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 422 })
  }

  const { page, pageSize, status, fornecedor, dataInicio, dataFim, search } = parsed.data

  const dataInicioParsed = dataInicio ? parseDateBrStart(dataInicio) : null
  const dataFimParsed = dataFim ? parseDateBrEnd(dataFim) : null

  if (dataInicio && !dataInicioParsed) {
    return NextResponse.json({ error: 'Data início inválida. Use dd/mm/aaaa.' }, { status: 422 })
  }
  if (dataFim && !dataFimParsed) {
    return NextResponse.json({ error: 'Data fim inválida. Use dd/mm/aaaa.' }, { status: 422 })
  }

  const where = {
    ...(status && { status }),
    ...(fornecedor && {
      fornecedorNome: { contains: fornecedor, mode: 'insensitive' as const },
    }),
    ...(search && { numero: { contains: search, mode: 'insensitive' as const } }),
    ...((dataInicio ?? dataFim)
      ? {
          dataEmissao: {
            ...(dataInicioParsed && { gte: dataInicioParsed }),
            ...(dataFimParsed && { lte: dataFimParsed }),
          },
        }
      : {}),
  }

  const [pedidos, total] = await Promise.all([
    prisma.pedidoCompra.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { dataEmissao: 'desc' },
      include: {
        itens: { select: { id: true, status: true } },
      },
    }),
    prisma.pedidoCompra.count({ where }),
  ])

  const data = pedidos.map(({ itens, ...p }) => ({
    ...p,
    totalItens: itens.length,
    totalPendentes: itens.filter((i) => i.status === StatusItem.PENDENTE).length,
  }))

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
