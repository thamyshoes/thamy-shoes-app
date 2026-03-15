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
  observacoes:      z.string().optional(),
  gradeId:          z.string().uuid().nullable().optional(),
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
        ],
      }
    : {}

  const [modelosRaw, total] = await Promise.all([
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

  // Re-sort in memory: exact match first, then starts-with, then the rest alphabetically
  const searchLower = search.toLowerCase()
  const modelos = search
    ? [...modelosRaw].sort((a, b) => {
        const aCode = a.codigo.toLowerCase()
        const bCode = b.codigo.toLowerCase()
        const aExact = aCode === searchLower ? 0 : 1
        const bExact = bCode === searchLower ? 0 : 1
        if (aExact !== bExact) return aExact - bExact
        const aStarts = aCode.startsWith(searchLower) ? 0 : 1
        const bStarts = bCode.startsWith(searchLower) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        // Among starts-with, shorter codes first (closer match)
        if (aStarts === 0 && bStarts === 0 && a.codigo.length !== b.codigo.length) {
          return a.codigo.length - b.codigo.length
        }
        return aCode.localeCompare(bCode)
      })
    : modelosRaw

  // Enriquecer com grade atual de cada modelo
  const gradeAtualMap = new Map<string, { id: string; nome: string; tamanhoMin: number; tamanhoMax: number }>()
  if (modelos.length > 0) {
    const codigos = modelos.map((m) => m.codigo)
    const gradeModelos = await prisma.gradeModelo.findMany({
      where: { modelo: { in: codigos } },
      include: { grade: true },
      orderBy: { createdAt: 'asc' },  // mais antigo primeiro → último no Map ganha (mais recente)
    })
    for (const gm of gradeModelos) {
      gradeAtualMap.set(gm.modelo, {
        id: gm.grade.id,
        nome: gm.grade.nome,
        tamanhoMin: gm.grade.tamanhoMin,
        tamanhoMax: gm.grade.tamanhoMax,
      })
    }
  }

  const items = modelos.map((m) => ({ ...m, gradeAtual: gradeAtualMap.get(m.codigo) ?? null }))

  return NextResponse.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
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

  const { codigo, nome, cabedal, sola, palmilha, materialCabedal, materialSola, materialPalmilha, materialFacheta, facheta, observacoes, gradeId } = parsed.data

  const existing = await prisma.modelo.findUnique({ where: { codigo } })
  if (existing) {
    return NextResponse.json({ error: `Modelo "${codigo}" já cadastrado` }, { status: 409 })
  }

  const modelo = await prisma.$transaction(async (tx) => {
    const created = await tx.modelo.create({
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
        observacoes:      observacoes      ?? null,
      },
      include: { variantesCor: true },
    })
    if (gradeId) {
      await tx.gradeModelo.create({ data: { gradeId, modelo: created.codigo } })
    }
    return created
  })

  return NextResponse.json(modelo, { status: 201 })
}
