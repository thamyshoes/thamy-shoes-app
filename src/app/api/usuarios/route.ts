import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, toUserPublic } from '@/lib/auth'
import { createUserSchema, paginationSchema } from '@/lib/validators'
import { Perfil } from '@/types'
import type { PaginatedResponse, UserPublic } from '@/types'

// GET /api/usuarios
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const { page, pageSize } = paginationSchema.parse({
    page: searchParams.get('page') ?? '1',
    pageSize: searchParams.get('pageSize') ?? '20',
  })
  const search = searchParams.get('search') ?? ''

  const where = search
    ? {
        OR: [
          { nome: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { nome: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  const response: PaginatedResponse<UserPublic> = {
    data: users.map(toUserPublic),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }

  return NextResponse.json(response)
}

// POST /api/usuarios
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { email, nome, password, perfil, setor } = parsed.data

  // Setor obrigatório para PRODUCAO
  if (perfil === Perfil.PRODUCAO && !setor) {
    return NextResponse.json(
      { error: 'Setor obrigatório para perfil PRODUCAO' },
      { status: 400 },
    )
  }

  // Verificar email duplicado
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'Email já está em uso' },
      { status: 409 },
    )
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      nome,
      passwordHash,
      perfil: perfil as import('@prisma/client').Perfil,
      setor: setor as import('@prisma/client').Setor | null,
    },
  })

  return NextResponse.json(toUserPublic(user), { status: 201 })
}
