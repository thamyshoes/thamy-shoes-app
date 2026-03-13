import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { StatusPedido } from '@/types'
import { ConsolidadoPage } from '@/components/pedidos/consolidado-page'
import type { PedidoItemConsolidado } from '@/components/pedidos/consolidado-page'

export const metadata: Metadata = {
  title: 'Gerar Consolidado | Thamy Shoes',
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const pedidos = await prisma.pedidoCompra.findMany({
    where: { status: { not: StatusPedido.PENDENTE_AJUSTE } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      numero: true,
      fornecedorNome: true,
      _count: { select: { itens: true } },
    },
  })

  const pedidosList: PedidoItemConsolidado[] = pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    cliente: p.fornecedorNome,
    totalItens: p._count.itens,
  }))

  return <ConsolidadoPage pedidos={pedidosList} />
}
