import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const updateSchema = z.object({
  // codigo é imutável: não aceitar alteração via API (consistente com a UI)
  nome:             z.string().min(1).max(100).optional(),
  linha:            z.string().max(100).nullable().optional(),
  cabedal:          z.string().max(200).nullable().optional(),
  sola:             z.string().max(200).nullable().optional(),
  palmilha:         z.string().max(200).nullable().optional(),
  facheta:          z.string().max(200).nullable().optional(),
  materialCabedal:  z.string().max(200).nullable().optional(),
  materialSola:     z.string().max(200).nullable().optional(),
  materialPalmilha: z.string().max(200).nullable().optional(),
  materialFacheta:  z.string().max(200).nullable().optional(),
  gradeId:          z.string().uuid().nullable().optional(),
})

async function handleUpdate(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
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
    const { gradeId, ...modeloFields } = parsed.data
    const modelo = await prisma.$transaction(async (tx) => {
      const updated = await tx.modelo.update({
        where: { id },
        data: modeloFields,
        include: { variantesCor: { orderBy: { corCodigo: 'asc' } } },
      })
      if (gradeId !== undefined) {
        await tx.gradeModelo.deleteMany({ where: { modelo: updated.codigo } })
        if (gradeId) {
          await tx.gradeModelo.create({ data: { gradeId, modelo: updated.codigo } })
        }
      }
      return updated
    })
    return NextResponse.json(modelo)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar modelo' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return handleUpdate(request, id)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return handleUpdate(request, id)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = requireAdmin(request)
  if (guard) return guard

  try {
    await prisma.modelo.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
      }
      if (err.code === 'P2003' || err.code === 'P2014') {
        return NextResponse.json({ error: 'Modelo possui registros vinculados e não pode ser excluído' }, { status: 409 })
      }
    }
    return NextResponse.json({ error: 'Erro ao excluir modelo' }, { status: 500 })
  }
}
