import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP } from '@/lib/api-guard'

const addModeloSchema = z.object({
  modelo: z.string().min(1, 'Modelo é obrigatório'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  const grade = await prisma.gradeNumeracao.findUnique({ where: { id } })
  if (!grade) return NextResponse.json({ error: 'Grade não encontrada' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = addModeloSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // Semântica "move": remove vínculo anterior (qualquer grade) e cria o novo
  // Garante regra 1 modelo → 1 grade mesmo via endpoint legado
  const gradeModelo = await prisma.$transaction(async (tx) => {
    await tx.gradeModelo.deleteMany({ where: { modelo: parsed.data.modelo } })
    return tx.gradeModelo.create({ data: { gradeId: id, modelo: parsed.data.modelo } })
  })
  return NextResponse.json(gradeModelo, { status: 201 })
}
