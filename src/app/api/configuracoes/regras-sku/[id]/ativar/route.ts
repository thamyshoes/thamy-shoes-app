import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

export async function PATCH(
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

  // Desativa todas as regras e ativa a selecionada em transação
  await prisma.$transaction([
    prisma.regraSkU.updateMany({ data: { ativa: false } }),
    prisma.regraSkU.update({ where: { id }, data: { ativa: true } }),
  ])

  const atualizada = await prisma.regraSkU.findUniqueOrThrow({ where: { id } })
  return NextResponse.json(atualizada)
}
