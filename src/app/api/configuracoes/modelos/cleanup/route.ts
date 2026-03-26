import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

// GET /api/configuracoes/modelos/cleanup
// Identifica modelos garbled: códigos que parecem ser versões "deslocadas" de outro modelo.
// Ex: '80540' é garbled porque '8054' é o modelo real (80540 = 8054 + '0' deslocado do SKU).
// Heurística: para cada modelo numérico, verificar se removendo 1-2 chars do final
// resulta em outro modelo existente na tabela.
export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const modelos = await prisma.modelo.findMany({
    select: {
      id: true,
      codigo: true,
      nome: true,
      createdAt: true,
      _count: { select: { variantesCor: true, itens: true } },
    },
    orderBy: { codigo: 'asc' },
  })

  // Construir set de todos os códigos para lookup rápido
  const codigosExistentes = new Set(modelos.map((m) => m.codigo))

  const suspeitos: {
    id: string
    codigo: string
    nome: string
    motivo: string
    modeloCorreto: string | null
    variantesCount: number
    itensVinculados: number
    createdAt: Date
  }[] = []

  for (const m of modelos) {
    // Só verificar códigos com 4+ chars (modelos reais podem ter 3-4 chars)
    if (m.codigo.length < 4) continue

    let motivo: string | null = null
    let modeloCorreto: string | null = null

    // Heurística 1: código numérico onde remover 1 char do final gera outro modelo existente
    // Ex: '80540' → '8054' existe? Se sim, '80540' é provavelmente garbled.
    const semUltimo = m.codigo.slice(0, -1)
    if (semUltimo.length >= 3 && codigosExistentes.has(semUltimo)) {
      motivo = `código '${m.codigo}' parece ser versão deslocada de '${semUltimo}' (que existe na tabela)`
      modeloCorreto = semUltimo
    }

    // Heurística 2: código numérico longo (8+ chars, puramente numérico) sem itens vinculados
    // Modelos reais raramente têm 8+ dígitos. Códigos como '30700062' são garbled.
    if (!motivo && m.codigo.length >= 8 && /^\d+$/.test(m.codigo) && m._count.itens === 0) {
      motivo = `código numérico muito longo (${m.codigo.length} chars) sem itens vinculados — possível SKU parseado incorretamente`
    }

    // Heurística 3: código onde remover 2 chars do final gera outro modelo existente
    // Ex: '305010' → '3050' existe? Captura deslocamentos maiores.
    if (!motivo && m.codigo.length >= 5) {
      const semDois = m.codigo.slice(0, -2)
      if (semDois.length >= 3 && codigosExistentes.has(semDois)) {
        motivo = `código '${m.codigo}' parece ser versão deslocada de '${semDois}' (que existe na tabela)`
        modeloCorreto = semDois
      }
    }

    if (motivo) {
      suspeitos.push({
        id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        motivo,
        modeloCorreto,
        variantesCount: m._count.variantesCor,
        itensVinculados: m._count.itens,
        createdAt: m.createdAt,
      })
    }
  }

  return NextResponse.json({
    totalModelos: modelos.length,
    suspeitos: suspeitos.length,
    lista: suspeitos,
  })
}

// DELETE /api/configuracoes/modelos/cleanup
// Remove modelos confirmados como garbled. Body: { ids: string[] }
// Modelos com itens de pedido vinculados NÃO são removidos (proteção).
export async function DELETE(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const ids = (body as { ids?: string[] }).ids
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Campo "ids" obrigatório (array de UUIDs)' }, { status: 400 })
  }

  // Verificar quais modelos têm itens vinculados (proteção)
  const modelosComItens = await prisma.modelo.findMany({
    where: { id: { in: ids }, itens: { some: {} } },
    select: { id: true, codigo: true },
  })

  const protegidos = new Set(modelosComItens.map((m) => m.id))
  const idsParaDeletar = ids.filter((id) => !protegidos.has(id))

  if (idsParaDeletar.length === 0) {
    return NextResponse.json({
      deletados: 0,
      protegidos: modelosComItens.map((m) => m.codigo),
      mensagem: 'Nenhum modelo deletado — todos têm itens de pedido vinculados.',
    })
  }

  // Deletar variantes e modelos em transação
  const result = await prisma.$transaction(async (tx) => {
    await tx.modeloVarianteCor.deleteMany({ where: { modeloId: { in: idsParaDeletar } } })
    const deleted = await tx.modelo.deleteMany({ where: { id: { in: idsParaDeletar } } })
    return deleted.count
  })

  return NextResponse.json({
    deletados: result,
    protegidos: modelosComItens.map((m) => m.codigo),
  })
}
