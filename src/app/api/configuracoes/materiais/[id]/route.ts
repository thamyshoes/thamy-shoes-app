import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP } from '@/lib/api-guard'

const updateSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').optional(),
  ativo: z.boolean().optional(),
})

// PATCH /api/configuracoes/materiais/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdminOrPCP(request)
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

  const existing = await prisma.material.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  }

  if (parsed.data.nome) {
    const dup = await prisma.material.findUnique({
      where: { nome_categoria: { nome: parsed.data.nome, categoria: existing.categoria } },
    })
    if (dup && dup.id !== id) {
      return NextResponse.json({ error: `Material "${parsed.data.nome}" já cadastrado nessa categoria` }, { status: 409 })
    }
  }

  const updated = await prisma.material.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

// DELETE /api/configuracoes/materiais/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  const { id } = await params

  const existing = await prisma.material.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  }

  await prisma.material.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
