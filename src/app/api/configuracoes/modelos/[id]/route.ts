import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const updateSchema = z.object({
  codigo: z.string().min(1).max(30).optional(),
  nome: z.string().min(1).optional(),
  cabedal: z.string().nullable().optional(),
  sola: z.string().nullable().optional(),
  palmilha: z.string().nullable().optional(),
  temFacheta: z.boolean().optional(),
  materialBasePalmilha: z.string().nullable().optional(),
  linha: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
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
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  try {
    const modelo = await prisma.modelo.update({
      where: { id },
      data: parsed.data,
      include: { variantesCor: { orderBy: { corCodigo: 'asc' } } },
    })
    return NextResponse.json(modelo)
  } catch {
    return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
  }
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
  } catch {
    return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
  }
}
