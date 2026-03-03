import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  separador: z.string().length(1).optional(),
  ordem: z.array(z.enum(['modelo', 'cor', 'tamanho'])).length(3).optional(),
  segmentos: z.array(z.string()).optional(),
})

export async function PATCH(
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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  try {
    const regra = await prisma.regraSkU.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json(regra)
  } catch {
    return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = requireAdmin(request)
  if (guard) return guard

  const regra = await prisma.regraSkU.findUnique({ where: { id } })
  if (!regra) {
    return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
  }
  if (regra.ativa) {
    return NextResponse.json(
      { error: 'Não é possível excluir a regra ativa' },
      { status: 409 },
    )
  }

  await prisma.regraSkU.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
