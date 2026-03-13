import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { StatusItem, StatusPedido } from '@/types'

const editItemSchema = z.object({
  itemId: z.string().uuid(),
  modelo: z.string().min(1).optional(),
  cor: z.string().min(1).optional(),
  corDescricao: z.string().optional(),
  tamanho: z.string().optional(),
})

// PUT /api/pedidos/:id/itens
// Auth: ADMIN, PCP — protected by middleware
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pedidoId } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = editItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { itemId, modelo, cor, corDescricao, tamanho } = parsed.data

  // Verificar que o item pertence ao pedido
  const item = await prisma.itemPedido.findFirst({
    where: { id: itemId, pedidoId },
  })

  if (!item) {
    return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
  }

  const novoModelo = modelo ?? item.modelo
  const novaCor = cor ?? item.cor
  const novoTamanho = tamanho != null ? parseInt(tamanho, 10) || null : item.tamanho

  const todosPreenchidos =
    novoModelo != null && novaCor != null && novoTamanho != null

  // Resolver modeloId a partir do código do modelo
  let modeloId: string | null = item.modeloId
  if (modelo && modelo !== item.modelo) {
    const modeloCadastrado = await prisma.modelo.findUnique({
      where: { codigo: modelo },
      select: { id: true },
    })
    modeloId = modeloCadastrado?.id ?? null
  }

  const itemAtualizado = await prisma.itemPedido.update({
    where: { id: itemId },
    data: {
      modelo: novoModelo,
      cor: novaCor,
      corDescricao: corDescricao ?? item.corDescricao,
      tamanho: novoTamanho,
      modeloId,
      status: todosPreenchidos ? StatusItem.RESOLVIDO : StatusItem.PENDENTE,
    },
  })

  // Verificar se todos os itens do pedido estão RESOLVIDOS
  const pendentes = await prisma.itemPedido.count({
    where: { pedidoId, status: StatusItem.PENDENTE },
  })

  // Se pedido estava PENDENTE_AJUSTE e todos resolvidos: voltar para IMPORTADO
  if (pendentes === 0) {
    await prisma.pedidoCompra.update({
      where: { id: pedidoId, status: StatusPedido.PENDENTE_AJUSTE },
      data: { status: StatusPedido.IMPORTADO },
    }).catch(() => {
      // Ignora se o pedido não estava em PENDENTE_AJUSTE
    })
  }

  return NextResponse.json({ data: itemAtualizado })
}
