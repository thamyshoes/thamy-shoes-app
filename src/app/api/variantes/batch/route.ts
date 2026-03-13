import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'
import { VarianteBatchSchema } from '@/lib/schemas/fichas-v2'

// PUT /api/variantes/batch
// Salva variantes de um modelo em lote: upsert (create/update) + delete em transação.
export async function PUT(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = VarianteBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { modeloId, variantes, deletedIds } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Deletar variantes marcadas para remoção (restrito ao modeloId por segurança)
      if (deletedIds && deletedIds.length > 0) {
        await tx.modeloVarianteCor.deleteMany({
          where: { id: { in: deletedIds }, modeloId },
        })
      }

      // 2. Persistir variantes: update por id (existentes) ou create (novas)
      // NÃO usar upsert por (modeloId, corCodigo): se o usuário mudar a cor, o upsert criaria
      // um registro duplicado e deixaria o original órfão no banco.
      for (const v of variantes) {
        const campos = {
          corCodigo:   v.corCodigo,
          imagemUrl:   v.imagemUrl   ?? null,
          corCabedal:  v.corCabedal  ?? null,
          corSola:     v.corSola     ?? null,
          corPalmilha: v.corPalmilha ?? null,
          corFacheta:  v.corFacheta  ?? null,
        }

        if (v.id) {
          // Variante existente: atualiza por id (restrito ao modeloId por segurança)
          await tx.modeloVarianteCor.update({
            where: { id: v.id, modeloId },
            data: campos,
          })
        } else {
          // Nova variante: cria
          await tx.modeloVarianteCor.create({
            data: { modeloId, ...campos },
          })
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar variantes' }, { status: 500 })
  }
}
