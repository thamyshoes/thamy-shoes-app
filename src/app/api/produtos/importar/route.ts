import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const importarProdutoSchema = z.object({
  idBling: z.number().int().positive(),
  nome: z.string().min(1),
  codigo: z.string().min(1),
  imagemUrl: z.string().nullable().optional(),
})

// POST /api/produtos/importar
// Admin only — protected by middleware
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = importarProdutoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { idBling, nome, codigo, imagemUrl } = parsed.data

  // Verificar duplicata por idBling
  const existingById = await prisma.produto.findUnique({
    where: { idBling: BigInt(idBling) },
  })
  if (existingById) {
    return NextResponse.json(
      { error: 'Produto já importado', produto: existingById },
      { status: 409 },
    )
  }

  // Verificar duplicata por codigo (referência)
  const existingByCodigo = await prisma.produto.findUnique({ where: { codigo } })
  if (existingByCodigo) {
    return NextResponse.json(
      { error: `Código "${codigo}" já existe para outro produto`, produto: existingByCodigo },
      { status: 409 },
    )
  }

  const produto = await prisma.produto.create({
    data: {
      idBling: BigInt(idBling),
      nome,
      codigo,
      imagemUrl: imagemUrl ?? null,
      ativo: true,
    },
  })

  // Auto-vincular itens de pedido existentes cujo modelo bata com este código
  await prisma.itemPedido.updateMany({
    where: { modelo: codigo, produtoId: null },
    data: { produtoId: produto.id },
  })

  return NextResponse.json({ data: produto }, { status: 201 })
}
