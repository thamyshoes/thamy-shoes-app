import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP } from '@/lib/api-guard'

const updateSchema = z.object({
  codigo:   z.string().min(1).regex(/^[A-Z0-9]+$/).optional(),
  descricao: z.string().min(1).optional(),
  hex:      z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Formato inválido. Use #RRGGBB')
             .optional()
             .nullable()
             .transform((v) => v ?? null),
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
    const cor = await prisma.mapeamentoCor.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json(cor)
  } catch {
    return NextResponse.json({ error: 'Mapeamento não encontrado' }, { status: 404 })
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
    await prisma.mapeamentoCor.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Mapeamento não encontrado' }, { status: 404 })
  }
}
