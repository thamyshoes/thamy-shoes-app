import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

const updateSchema = z.object({
  codigo: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
})

// PATCH /api/configuracoes/referencias/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const { id } = await params

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

  const existing = await prisma.referencia.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Referência não encontrada' }, { status: 404 })
  }

  if (parsed.data.codigo) {
    const dup = await prisma.referencia.findUnique({
      where: { codigo_categoria: { codigo: parsed.data.codigo, categoria: existing.categoria } },
    })
    if (dup && dup.id !== id) {
      return NextResponse.json({ error: `Referência "${parsed.data.codigo}" já cadastrada nessa categoria` }, { status: 409 })
    }
  }

  const updated = await prisma.referencia.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

// DELETE /api/configuracoes/referencias/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const { id } = await params

  const existing = await prisma.referencia.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Referência não encontrada' }, { status: 404 })
  }

  await prisma.referencia.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
