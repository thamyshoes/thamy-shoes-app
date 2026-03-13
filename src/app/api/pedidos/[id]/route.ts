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

  // Verificar quais cores dos itens estão mapeadas (única query)
  const coresDosItens = pedido.itens
    .map((i) => i.cor)
    .filter((c): c is string => !!c)
  const coresMapeadas = coresDosItens.length > 0
    ? await prisma.mapeamentoCor.findMany({
        where: { codigo: { in: coresDosItens } },
        select: { codigo: true, hex: true, descricao: true },
      })
    : []
  const coresMap = new Map(coresMapeadas.map((c) => [c.codigo, c]))

  const itensEnriquecidos = pedido.itens.map((item) => {
    const corInfo = item.cor ? coresMap.get(item.cor) : undefined
    return {
      ...item,
      corMapeada: item.cor ? !!corInfo : null,
      hex: corInfo?.hex ?? null,
      corDescricao: item.corDescricao ?? corInfo?.descricao ?? null,
    }
  })

  // Verificar temFacheta: algum modelo dos itens tem campo facheta preenchido
  const codigosModelo = [...new Set(pedido.itens.map((i) => i.modelo).filter((m): m is string => !!m))]
  let temFacheta = false
  if (codigosModelo.length > 0) {
    const modelosComFacheta = await prisma.modelo.findMany({
      where: {
        codigo: { in: codigosModelo },
        facheta: { not: null },
      },
      select: { id: true },
      take: 1,
    })
    temFacheta = modelosComFacheta.length > 0
  }

  const { idBling, fornecedorId, ...pedidoRest } = pedido

  return NextResponse.json({
    data: {
      ...pedidoRest,
      itens: itensEnriquecidos,
      idBling: idBling.toString(),
      fornecedorId: fornecedorId?.toString() ?? null,
      grades,
      totalItens: pedido.itens.length,
      totalPendentes,
      temFacheta,
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
