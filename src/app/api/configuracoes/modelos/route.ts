import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const createSchema = z.object({
  codigo:           z.string().min(1).max(30),
  nome:             z.string().min(1, 'Nome é obrigatório'),
  cabedal:          z.string().optional(),
  sola:             z.string().optional(),
  palmilha:         z.string().optional(),
  materialCabedal:  z.string().max(200).optional(),
  materialSola:     z.string().max(200).optional(),
  materialPalmilha: z.string().max(200).optional(),
  materialFacheta:  z.string().max(200).optional(),
  facheta:          z.string().max(200).optional(),
  linha:            z.string().optional(),
  observacoes:      z.string().optional(),
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
          { cabedal: { contains: search, mode: 'insensitive' as const } },
          { sola: { contains: search, mode: 'insensitive' as const } },
          { palmilha: { contains: search, mode: 'insensitive' as const } },
          { linha: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [modelos, total] = await Promise.all([
    prisma.modelo.findMany({
      where,
      include: {
        variantesCor: { orderBy: { corCodigo: 'asc' } },
      },
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

  const { codigo, nome, cabedal, sola, palmilha, materialCabedal, materialSola, materialPalmilha, materialFacheta, facheta, linha, observacoes } = parsed.data

  const existing = await prisma.modelo.findUnique({ where: { codigo } })
  if (existing) {
    return NextResponse.json({ error: `Modelo "${codigo}" já cadastrado` }, { status: 409 })
  }

  const modelo = await prisma.modelo.create({
    data: {
      codigo,
      nome,
      cabedal:          cabedal          ?? null,
      sola:             sola             ?? null,
      palmilha:         palmilha         ?? null,
      materialCabedal:  materialCabedal  ?? null,
      materialSola:     materialSola     ?? null,
      materialPalmilha: materialPalmilha ?? null,
      materialFacheta:  materialFacheta  ?? null,
      facheta:          facheta          ?? null,
      linha:            linha            ?? null,
      observacoes:      observacoes      ?? null,
    },
    include: { variantesCor: true },
  })

  return NextResponse.json(modelo, { status: 201 })
}
