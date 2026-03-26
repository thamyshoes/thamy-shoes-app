import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'
import { parseSku } from '@/lib/bling/sku-parser'

// GET /api/configuracoes/modelos/cleanup
// Identifica modelos com código potencialmente garbled (gerados por SKUs não-padrão).
// Critérios: código com 5+ chars que, ao ser re-parseado como SKU SUFIXO,
// gera um modelo DIFERENTE do código armazenado.
// Ex: código '80540' → parseSku('80540') → modelo=null (PENDENTE) → suspeito
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

  const suspeitos: {
    id: string
    codigo: string
    nome: string
    motivo: string
    variantesCount: number
    itensVinculados: number
    createdAt: Date
  }[] = []

  for (const m of modelos) {
    const motivos: string[] = []

    // Código muito longo para ser um modelo real (> 6 chars sem separador)
    if (m.codigo.length > 6 && /^\d+$/.test(m.codigo)) {
      motivos.push(`código numérico longo (${m.codigo.length} chars) — possível SKU parseado incorretamente`)
    }

    // Re-parsear como SKU para ver se gera outro modelo
    const parsed = await parseSku(m.codigo)
    if (parsed.modelo && parsed.modelo !== m.codigo) {
      motivos.push(`re-parsing como SKU gera modelo diferente: '${parsed.modelo}' (esperado '${m.codigo}')`)
    }

    // Código que termina com dígitos que parecem cor+tamanho (5+ chars numéricos)
    if (m.codigo.length >= 5 && /^\d+$/.test(m.codigo)) {
      const possibleTam = m.codigo.slice(-2)
      const possibleCor = m.codigo.slice(-5, -2)
      const possibleModelo = m.codigo.slice(0, -5)
      if (/^\d+$/.test(possibleTam) && /^\d+$/.test(possibleCor) && possibleModelo.length > 0) {
        // Verificar se o modelo "real" existe
        const realModelo = await prisma.modelo.findUnique({
          where: { codigo: possibleModelo },
          select: { id: true },
        })
        if (!realModelo) {
          motivos.push(`possível modelo correto '${possibleModelo}' não existe na tabela`)
        }
      }
    }

    if (motivos.length > 0) {
      suspeitos.push({
        id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        motivo: motivos.join('; '),
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
