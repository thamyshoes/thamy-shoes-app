import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface ModeloSemVariante {
  codigo: string
  nome: string
}

interface CorSemVariante {
  codigo: string
  nome: string
  cor: string
}

// GET /api/modelos/verificar-variantes?pedidoId={id}
// Retorna:
// - modelosSemVariante: modelos sem nenhuma variante cadastrada
// - coresSemVariante: pares (modelo, cor) do pedido sem variante correspondente
// - todosComVariante: true somente se ambas as listas estiverem vazias
export async function GET(req: NextRequest) {
  const pedidoId = req.nextUrl.searchParams.get('pedidoId')
  if (!pedidoId) {
    return NextResponse.json({ error: 'pedidoId é obrigatório' }, { status: 400 })
  }

  // Buscar pares (modelo, cor) distintos dos itens do pedido
  const itens = await prisma.itemPedido.findMany({
    where: { pedidoId },
    select: { modelo: true, cor: true },
  })

  const codigosModelo = [...new Set(
    itens.map((i) => i.modelo).filter((m): m is string => !!m)
  )]

  if (codigosModelo.length === 0) {
    // Pedido sem modelos identificados — não bloquear
    return NextResponse.json({
      todosComVariante: true,
      modelosSemVariante: [],
      coresSemVariante: [],
    })
  }

  // Buscar modelos com suas variantes de cor
  const modelos = await prisma.modelo.findMany({
    where: { codigo: { in: codigosModelo } },
    select: {
      codigo: true,
      nome: true,
      variantesCor: { select: { corCodigo: true } },
    },
  })

  const modeloMapa = new Map(modelos.map((m) => [m.codigo, m]))

  // 1. Modelos sem nenhuma variante cadastrada
  const modelosComCadastroSemVariante: ModeloSemVariante[] = modelos
    .filter((m) => m.variantesCor.length === 0)
    .map((m) => ({ codigo: m.codigo, nome: m.nome }))

  // 2. Modelos sem cadastro algum no sistema (tratamos como sem variante)
  const codigosComCadastro = new Set(modelos.map((m) => m.codigo))
  const semCadastro: ModeloSemVariante[] = codigosModelo
    .filter((c) => !codigosComCadastro.has(c))
    .map((c) => ({ codigo: c, nome: 'Não cadastrado' }))

  const modelosSemVariante: ModeloSemVariante[] = [...modelosComCadastroSemVariante, ...semCadastro]

  // 3. Pares (modelo, cor) do pedido sem variante correspondente
  // Considerar apenas itens que têm AMBOS modelo e cor preenchidos
  const paresUnicos = new Map<string, { modelo: string; cor: string }>()
  for (const item of itens) {
    if (item.modelo && item.cor) {
      paresUnicos.set(`${item.modelo}__${item.cor}`, { modelo: item.modelo, cor: item.cor })
    }
  }

  const coresSemVariante: CorSemVariante[] = []
  for (const { modelo, cor } of paresUnicos.values()) {
    const modeloInfo = modeloMapa.get(modelo)
    if (!modeloInfo) continue // já está em modelosSemVariante (sem cadastro)
    const temVarianteCor = modeloInfo.variantesCor.some((v) => v.corCodigo === cor)
    if (!temVarianteCor) {
      coresSemVariante.push({ codigo: modelo, nome: modeloInfo.nome, cor })
    }
  }

  return NextResponse.json({
    todosComVariante: modelosSemVariante.length === 0 && coresSemVariante.length === 0,
    modelosSemVariante,
    coresSemVariante,
  })
}
