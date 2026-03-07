import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { blingService } from '@/lib/bling/bling-service'
import { interpretarItens } from '@/lib/bling/sku-parser'
import { importPedidoSchema } from '@/lib/validators'
import { StatusPedido, StatusItem } from '@/types'

// POST /api/pedidos/:id/reimportar
// Auth: ADMIN only — protected by middleware
// Reimporta usando o idBling armazenado no pedido (não requer body)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const pedido = await prisma.pedidoCompra.findUnique({ where: { id } })

  if (!pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  if (pedido.status === StatusPedido.FICHAS_GERADAS) {
    return NextResponse.json(
      { error: 'Pedido já possui fichas geradas' },
      { status: 409 },
    )
  }

  const idBling = Number(pedido.idBling)
  const pedidoBling = await blingService.getPedidoCompra(idBling)

  await prisma.itemPedido.deleteMany({ where: { pedidoId: id } })

  await prisma.pedidoCompra.update({
    where: { id },
    data: {
      dataEmissao: new Date(pedidoBling.dataCompra ?? pedidoBling.data ?? new Date()),
      dataPrevista: pedidoBling.dataPrevista && pedidoBling.dataPrevista !== '0000-00-00'
        ? new Date(pedidoBling.dataPrevista)
        : null,
      fornecedorNome: pedidoBling.fornecedor?.nome ?? '',
      observacoes: pedidoBling.observacoes ?? null,
      status: StatusPedido.IMPORTADO,
      itens: {
        createMany: {
          data: pedidoBling.itens.map((item) => ({
            descricaoBruta: item.descricao,
            skuBruto: item.sku ?? null,
            quantidade: item.quantidade,
            unidade: item.unidade || 'UN',
            variacoes: item.variacoes
              ? (item.variacoes as unknown as import('@prisma/client').Prisma.InputJsonValue)
              : undefined,
            status: StatusItem.PENDENTE,
          })),
        },
      },
    },
  })

  const novosItens = await prisma.itemPedido.findMany({ where: { pedidoId: id } })
  await interpretarItens(novosItens)

  const pedidoAtualizado = await prisma.pedidoCompra.findUnique({
    where: { id },
    include: { itens: true },
  })

  return NextResponse.json({
    data: pedidoAtualizado
      ? { ...pedidoAtualizado, idBling: pedidoAtualizado.idBling.toString(), fornecedorId: pedidoAtualizado.fornecedorId?.toString() ?? null }
      : null,
  })
}

// PUT /api/pedidos/:id/reimportar
// Admin only — protected by middleware
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = importPedidoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { idBling } = parsed.data

  // Verificar se o pedido existe no banco
  const existing = await prisma.pedidoCompra.findUnique({
    where: { id },
    include: { itens: { select: { id: true } } },
  })

  if (!existing) {
    return NextResponse.json(
      { error: 'Pedido não encontrado' },
      { status: 404 },
    )
  }

  // Buscar dados atualizados do Bling
  const pedidoBling = await blingService.getPedidoCompra(idBling)

  // Atualizar PedidoCompra com dados frescos do Bling
  // 1. Deletar itens antigos
  await prisma.itemPedido.deleteMany({ where: { pedidoId: id } })

  // 2. Atualizar dados do pedido e criar novos itens
  const pedido = await prisma.pedidoCompra.update({
    where: { id },
    data: {
      dataEmissao: new Date(pedidoBling.dataCompra ?? pedidoBling.data ?? new Date()),
      dataPrevista: pedidoBling.dataPrevista && pedidoBling.dataPrevista !== '0000-00-00'
        ? new Date(pedidoBling.dataPrevista)
        : null,
      fornecedorNome: pedidoBling.fornecedor?.nome ?? '',
      observacoes: pedidoBling.observacoes ?? null,
      status: StatusPedido.IMPORTADO,
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

  // 3. Interpretar SKUs dos novos itens
  const itens = await prisma.itemPedido.findMany({ where: { pedidoId: pedido.id } })
  await interpretarItens(itens)

  // Recarregar pedido com itens atualizados (após interpretação)
  const pedidoAtualizado = await prisma.pedidoCompra.findUnique({
    where: { id },
    include: { itens: true },
  })

  return NextResponse.json({
    data: pedidoAtualizado
      ? { ...pedidoAtualizado, idBling: pedidoAtualizado.idBling.toString(), fornecedorId: pedidoAtualizado.fornecedorId?.toString() ?? null }
      : null,
  })
}
