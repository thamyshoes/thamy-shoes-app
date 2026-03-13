import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { parseDateBrEnd, parseDateBrStart } from '@/lib/format'
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

  const dataInicioParsed = dataInicio ? parseDateBrStart(dataInicio) : null
  const dataFimParsed = dataFim ? parseDateBrEnd(dataFim) : null

  if (dataInicio && !dataInicioParsed) {
    return NextResponse.json({ error: 'Data início inválida. Use dd/mm/aaaa.' }, { status: 422 })
  }
  if (dataFim && !dataFimParsed) {
    return NextResponse.json({ error: 'Data fim inválida. Use dd/mm/aaaa.' }, { status: 422 })
  }

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

  if (dataInicioParsed || dataFimParsed) {
    where.createdAt = {
      ...(dataInicioParsed ? { gte: dataInicioParsed } : {}),
      ...(dataFimParsed ? { lte: dataFimParsed } : {}),
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

  // ── Buscar todas as fichas que batem no filtro ────────────────────────────
  const allFichas = await prisma.fichaProducao.findMany({
    where,
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
  })

  // ── Agrupar por pedido/consolidado ────────────────────────────────────────
  const groupMap = new Map<string, typeof allFichas>()

  for (const f of allFichas) {
    const key = f.consolidadoId
      ? `consolidado-${f.consolidadoId}`
      : `pedido-${f.pedidoId ?? f.id}`

    if (!groupMap.has(key)) {
      groupMap.set(key, [])
    }
    groupMap.get(key)!.push(f)
  }

  const allGroups = Array.from(groupMap.values())
  const totalGroups = allGroups.length

  // ── Paginar por grupo (pedido) ────────────────────────────────────────────
  const skip = (page - 1) * pageSize
  const pagedGroups = allGroups.slice(skip, skip + pageSize)

  return NextResponse.json({
    groups: pagedGroups,
    total: totalGroups,
    page,
    pageSize,
    totalPages: Math.ceil(totalGroups / pageSize),
  })
}
