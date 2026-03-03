import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Setor } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const perfil = request.headers.get('x-user-perfil')
  const userSetor = request.headers.get('x-user-setor')

  if (!perfil) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const ficha = await prisma.fichaProducao.findUnique({
    where: { id },
    include: {
      pedido: {
        select: { numero: true, fornecedorNome: true },
      },
      consolidado: {
        select: { id: true },
      },
    },
  })

  if (!ficha) {
    return NextResponse.json({ error: 'Ficha não encontrada' }, { status: 404 })
  }

  // PRODUCAO só pode ver fichas do seu setor
  if (perfil === 'PRODUCAO' && userSetor && ficha.setor !== (userSetor as Setor)) {
    return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 403 })
  }

  return NextResponse.json({ data: ficha })
}
