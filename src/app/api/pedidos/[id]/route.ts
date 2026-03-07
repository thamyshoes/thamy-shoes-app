import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { montarGrades } from '@/lib/bling/sku-parser'
import { StatusItem } from '@/types'

// GET /api/pedidos/:id
// Auth: ADMIN, PCP — protected by middleware
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const pedido = await prisma.pedidoCompra.findUnique({
    where: { id },
    include: {
      itens: {
        orderBy: { createdAt: 'asc' },
      },
      fichas: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  const grades = await montarGrades(id)

  const totalPendentes = pedido.itens.filter((i) => i.status === StatusItem.PENDENTE).length

  const { idBling, fornecedorId, ...pedidoRest } = pedido

  return NextResponse.json({
    data: {
      ...pedidoRest,
      idBling: idBling.toString(),
      fornecedorId: fornecedorId?.toString() ?? null,
      grades,
      totalItens: pedido.itens.length,
      totalPendentes,
    },
  })
}

// DELETE /api/pedidos/:id
// Auth: ADMIN only — protected by middleware
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const pedido = await prisma.pedidoCompra.findUnique({
    where: { id },
    include: { _count: { select: { fichas: true } } },
  })

  if (!pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  if (pedido._count.fichas > 0) {
    return NextResponse.json(
      { error: 'Não é possível excluir pedido com fichas geradas' },
      { status: 409 },
    )
  }

  await prisma.pedidoCompra.delete({ where: { id } })

  return NextResponse.json({ data: { deleted: true } })
}
