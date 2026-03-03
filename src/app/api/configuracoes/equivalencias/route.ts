import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { EscopoEquivalencia } from '@prisma/client'
import { requireAdmin } from '@/lib/api-guard'

const createSchema = z.object({
  escopo: z.nativeEnum(EscopoEquivalencia),
  valor: z.string().nullable().optional(),
}).refine((d) => d.escopo !== 'REFERENCIA' || (d.valor && d.valor.trim().length > 0), {
  message: 'Modelo obrigatório para escopo REFERENCIA',
  path: ['valor'],
})

export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const equivalencias = await prisma.regraEquivalencia.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(equivalencias)
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

  const equivalencia = await prisma.regraEquivalencia.create({
    data: {
      escopo: parsed.data.escopo,
      valor: parsed.data.escopo === 'GLOBAL' ? null : (parsed.data.valor ?? null),
    },
  })
  return NextResponse.json(equivalencia, { status: 201 })
}
