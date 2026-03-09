import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/api-guard'
import { CategoriaMaterial } from '@prisma/client'

const createSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  categoria: z.nativeEnum(CategoriaMaterial),
})

// GET /api/configuracoes/materiais?categoria=CABEDAL
export async function GET(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  const categoria = request.nextUrl.searchParams.get('categoria') as CategoriaMaterial | null

  const where = categoria ? { categoria, ativo: true } : { ativo: true }

  const materiais = await prisma.material.findMany({
    where,
    orderBy: { nome: 'asc' },
  })

  return NextResponse.json(materiais)
}

// POST /api/configuracoes/materiais
export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
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

  const existing = await prisma.material.findUnique({
    where: { nome_categoria: { nome: parsed.data.nome, categoria: parsed.data.categoria } },
  })
  if (existing) {
    return NextResponse.json({ error: `Material "${parsed.data.nome}" já cadastrado nessa categoria` }, { status: 409 })
  }

  const material = await prisma.material.create({ data: parsed.data })
  return NextResponse.json(material, { status: 201 })
}
