import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminOrPCP } from '@/lib/api-guard'
import { CategoriaMaterial } from '@prisma/client'

const createSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
  descricao: z.string().optional(),
  categoria: z.nativeEnum(CategoriaMaterial),
})

// GET /api/configuracoes/referencias?categoria=CABEDAL
export async function GET(request: NextRequest) {
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  const categoria = request.nextUrl.searchParams.get('categoria') as CategoriaMaterial | null

  const where = categoria ? { categoria, ativo: true } : { ativo: true }

  const referencias = await prisma.referencia.findMany({
    where,
    orderBy: { codigo: 'asc' },
  })

  return NextResponse.json(referencias)
}

// POST /api/configuracoes/referencias
export async function POST(request: NextRequest) {
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const existing = await prisma.referencia.findUnique({
    where: { codigo_categoria: { codigo: parsed.data.codigo, categoria: parsed.data.categoria } },
  })
  if (existing) {
    return NextResponse.json({ error: `Referência "${parsed.data.codigo}" já cadastrada nessa categoria` }, { status: 409 })
  }

  const referencia = await prisma.referencia.create({ data: parsed.data })
  return NextResponse.json(referencia, { status: 201 })
}
