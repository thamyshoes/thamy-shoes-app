import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP } from '@/lib/api-guard'

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  tamanhoMin: z.number().int().min(1).optional(),
  tamanhoMax: z.number().int().min(1).optional(),
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

  // Validar min < max se ambos fornecidos
  const grade = await prisma.gradeNumeracao.findUnique({ where: { id } })
  if (!grade) return NextResponse.json({ error: 'Grade não encontrada' }, { status: 404 })

  const min = parsed.data.tamanhoMin ?? grade.tamanhoMin
  const max = parsed.data.tamanhoMax ?? grade.tamanhoMax
  if (min >= max) {
    return NextResponse.json(
      { error: 'Tamanho mínimo deve ser menor que o máximo' },
      { status: 400 },
    )
  }

  const atualizada = await prisma.gradeNumeracao.update({
    where: { id },
    data: parsed.data,
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
    await prisma.gradeNumeracao.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Grade não encontrada' }, { status: 404 })
  }
}
