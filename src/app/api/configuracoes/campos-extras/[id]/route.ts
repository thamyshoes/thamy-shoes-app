import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { TipoCampo } from '@prisma/client'
import { requireAdminOrPCP } from '@/lib/api-guard'

const updateSchema = z.object({
  nome: z.string().min(1).max(255).optional(),
  tipo: z.nativeEnum(TipoCampo).optional(),
  obrigatorio: z.boolean().optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
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

  try {
    const campo = await prisma.campoExtra.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json(campo)
  } catch {
    return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  try {
    await prisma.campoExtra.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 })
  }
}
