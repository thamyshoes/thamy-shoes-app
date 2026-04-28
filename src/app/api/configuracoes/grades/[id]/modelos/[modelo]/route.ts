import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP } from '@/lib/api-guard'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; modelo: string }> },
) {
  const { id, modelo } = await params
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  const modeloDecoded = decodeURIComponent(modelo)

  const gradeModelo = await prisma.gradeModelo.findFirst({
    where: { gradeId: id, modelo: modeloDecoded },
  })
  if (!gradeModelo) {
    return NextResponse.json({ error: 'Modelo não encontrado nesta grade' }, { status: 404 })
  }

  await prisma.gradeModelo.delete({ where: { id: gradeModelo.id } })
  return NextResponse.json({ ok: true })
}
