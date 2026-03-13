import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const createSchema = z.object({
  corCodigo:   z.string().min(1, 'Código da cor é obrigatório'),
  imagemUrl:   z.string().url().nullable().optional(),
  corCabedal:  z.string().nullable().optional(),
  corSola:     z.string().nullable().optional(),
  corPalmilha: z.string().nullable().optional(),
  corFacheta:  z.string().nullable().optional(),
})

// GET /api/configuracoes/modelos/[id]/variantes-cor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = requireAdmin(request)
  if (guard) return guard

  const variantes = await prisma.modeloVarianteCor.findMany({
    where: { modeloId: id },
    orderBy: { corCodigo: 'asc' },
  })

  return NextResponse.json(variantes)
}

// POST /api/configuracoes/modelos/[id]/variantes-cor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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

  const modelo = await prisma.modelo.findUnique({ where: { id } })
  if (!modelo) {
    return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
  }

  const existing = await prisma.modeloVarianteCor.findUnique({
    where: { modeloId_corCodigo: { modeloId: id, corCodigo: parsed.data.corCodigo } },
  })
  if (existing) {
    return NextResponse.json({ error: `Variante para cor "${parsed.data.corCodigo}" já existe` }, { status: 409 })
  }

  const variante = await prisma.modeloVarianteCor.create({
    data: {
      modeloId:    id,
      corCodigo:   parsed.data.corCodigo,
      imagemUrl:   parsed.data.imagemUrl   ?? null,
      corCabedal:  parsed.data.corCabedal  ?? null,
      corSola:     parsed.data.corSola     ?? null,
      corPalmilha: parsed.data.corPalmilha ?? null,
      corFacheta:  parsed.data.corFacheta  ?? null,
    },
  })

  return NextResponse.json(variante, { status: 201 })
}
