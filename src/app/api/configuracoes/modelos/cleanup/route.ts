import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'

// GET /api/configuracoes/modelos/cleanup
// Identifica modelos garbled criados pelo sync a partir de SKUs não-padrão.
// Garbled = código que é "pai existente + dígitos extras", COM nome auto-gerado "Modelo XXXXX"
// e SEM itens de pedido vinculados.
// Ex: '80510' (nome "Modelo 80510") é garbled porque '8051' existe e o nome é auto-gerado.
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
    modeloCorreto: string
    variantesCount: number
    itensVinculados: number
    createdAt: Date
  }[] = []

  for (const m of modelos) {
    if (m.codigo.length < 4) continue
    // Só considerar suspeito se NÃO tem itens de pedido vinculados
    if (m._count.itens > 0) continue

    // Verificar se removendo 1 char do final gera outro modelo existente
    const semUltimo = m.codigo.slice(0, -1)
    if (semUltimo.length >= 3 && codigosExistentes.has(semUltimo)) {
      // Filtro adicional: nome auto-gerado ("Modelo XXXXX") OU modelo sem variantes
      const nomeAutoGerado = m.nome === `Modelo ${m.codigo}`
      const semVariantesEDados = m._count.variantesCor === 0

      if (nomeAutoGerado || semVariantesEDados) {
        suspeitos.push({
          id: m.id,
          codigo: m.codigo,
          nome: m.nome,
          motivo: nomeAutoGerado
            ? `nome auto-gerado "Modelo ${m.codigo}" + pai '${semUltimo}' existe`
            : `sem variantes/itens + pai '${semUltimo}' existe`,
          modeloCorreto: semUltimo,
          variantesCount: m._count.variantesCor,
          itensVinculados: m._count.itens,
          createdAt: m.createdAt,
        })
      }
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
