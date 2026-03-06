import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { blingService } from '@/lib/bling/bling-service'
import { interpretarItens } from '@/lib/bling/sku-parser'
import { importPedidoSchema } from '@/lib/validators'
import { StatusPedido, StatusItem } from '@/types'

// POST /api/pedidos/importar
// Admin only — protected by middleware
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = importPedidoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { idBling } = parsed.data
  const importadoPor = req.headers.get('x-user-id')

  // Verificar duplicata
  const existing = await prisma.pedidoCompra.findUnique({
    where: { idBling: BigInt(idBling) },
    include: { itens: { select: { id: true } } },
  })

  if (existing) {
    return NextResponse.json(
      {
        error: 'Pedido já foi importado',
        pedido: {
          id: existing.id,
          numero: existing.numero,
          status: existing.status,
          createdAt: existing.createdAt,
          fichasGeradas: existing.status === StatusPedido.FICHAS_GERADAS,
        },
      },
      { status: 409 },
    )
  }

  // Buscar pedido no Bling
  const pedidoBling = await blingService.getPedidoCompra(idBling)

  // Criar PedidoCompra com seus itens
  const pedido = await prisma.pedidoCompra.create({
    data: {
      idBling: BigInt(idBling),
      numero: pedidoBling.numero,
      dataEmissao: new Date(pedidoBling.dataCompra ?? pedidoBling.data ?? new Date()),
      dataPrevista: pedidoBling.dataPrevista && pedidoBling.dataPrevista !== '0000-00-00'
        ? new Date(pedidoBling.dataPrevista)
        : null,
      fornecedorNome: pedidoBling.fornecedor?.nome ?? '',
      fornecedorId: pedidoBling.fornecedor ? BigInt(pedidoBling.fornecedor.id) : null,
      observacoes: pedidoBling.observacoes ?? null,
      status: StatusPedido.IMPORTADO,
      importadoPor: importadoPor ?? null,
      itens: {
        createMany: {
          data: pedidoBling.itens.map((item) => ({
            descricaoBruta: item.descricao,
            skuBruto: item.sku ?? null,
            quantidade: item.quantidade,
            unidade: item.unidade || 'UN',
            variacoes: item.variacoes ? (item.variacoes as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
            status: StatusItem.PENDENTE,
          })),
        },
      },
    },
    include: { itens: true },
  })

  // Auto-parse SKUs dos itens importados
  const itens = await prisma.itemPedido.findMany({ where: { pedidoId: pedido.id } })
  await interpretarItens(itens)

  return NextResponse.json({ data: pedido }, { status: 201 })
}
