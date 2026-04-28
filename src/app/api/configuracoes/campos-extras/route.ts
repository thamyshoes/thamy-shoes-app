import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Setor, TipoCampo } from '@prisma/client'
import { requireAdminOrPCP } from '@/lib/api-guard'

const createSchema = z.object({
  setor: z.nativeEnum(Setor),
  nome: z.string().min(1, 'Nome é obrigatório').max(255),
  tipo: z.nativeEnum(TipoCampo),
  obrigatorio: z.boolean().default(false),
  ordem: z.number().int().min(0).default(0),
})

const setorQuerySchema = z.object({
  setor: z.nativeEnum(Setor, { required_error: 'Parâmetro setor é obrigatório' }),
})

export async function GET(request: NextRequest) {
  const guard = requireAdminOrPCP(request)
  if (guard) return guard

  const setor = request.nextUrl.searchParams.get('setor')
  const parsed = setorQuerySchema.safeParse({ setor })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Parâmetro setor inválido' },
      { status: 400 },
    )
  }

  const campos = await prisma.campoExtra.findMany({
    where: { setor: parsed.data.setor },
    orderBy: { ordem: 'asc' },
  })

  return NextResponse.json(campos)
}

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
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  try {
    const campo = await prisma.campoExtra.create({ data: parsed.data })
    return NextResponse.json(campo, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Já existe um campo com este nome neste setor' },
      { status: 409 },
    )
  }
}
