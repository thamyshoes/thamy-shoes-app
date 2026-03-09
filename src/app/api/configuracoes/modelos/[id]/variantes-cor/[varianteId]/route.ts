import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const updateSchema = z.object({
  corCodigo: z.string().min(1).optional(),
  cabedalOverride: z.string().nullable().optional(),
  corSola: z.string().nullable().optional(),
  corFacheta: z.string().nullable().optional(),
  corForroPalmilha: z.string().nullable().optional(),
  codigoFichaPalmilha: z.string().nullable().optional(),
  descricaoPalmilha: z.string().nullable().optional(),
})

// PATCH /api/configuracoes/modelos/[id]/variantes-cor/[varianteId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varianteId: string }> },
) {
  const { varianteId } = await params
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
    const variante = await prisma.modeloVarianteCor.update({
      where: { id: varianteId },
      data: parsed.data,
    })
    return NextResponse.json(variante)
  } catch {
    return NextResponse.json({ error: 'Variante não encontrada' }, { status: 404 })
  }
}

// DELETE /api/configuracoes/modelos/[id]/variantes-cor/[varianteId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; varianteId: string }> },
) {
  const { varianteId } = await params
  const guard = requireAdmin(request)
  if (guard) return guard

  try {
    await prisma.modeloVarianteCor.delete({ where: { id: varianteId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Variante não encontrada' }, { status: 404 })
  }
}
