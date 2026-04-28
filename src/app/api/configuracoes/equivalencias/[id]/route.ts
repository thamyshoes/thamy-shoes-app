import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { EscopoEquivalencia } from '@prisma/client'
import { requireAdminOrPCP } from '@/lib/api-guard'

const updateSchema = z.object({
  escopo: z.nativeEnum(EscopoEquivalencia).optional(),
  valor: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // Validar valor obrigatório se escopo=REFERENCIA
  const existing = await prisma.regraEquivalencia.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Equivalência não encontrada' }, { status: 404 })

  const escopo = parsed.data.escopo ?? existing.escopo
  const valor = 'valor' in parsed.data ? parsed.data.valor : existing.valor
  if (escopo === 'REFERENCIA' && (!valor || !valor.trim())) {
    return NextResponse.json({ error: 'Modelo obrigatório para escopo REFERENCIA' }, { status: 400 })
  }

  const atualizada = await prisma.regraEquivalencia.update({
    where: { id },
    data: { escopo, valor: escopo === 'GLOBAL' ? null : valor },
  })
  return NextResponse.json(atualizada)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  try {
    await prisma.regraEquivalencia.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Equivalência não encontrada' }, { status: 404 })
  }
}
