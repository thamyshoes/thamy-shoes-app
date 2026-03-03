import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, toUserPublic } from '@/lib/auth'
import { updateUserSchema } from '@/lib/validators'

// GET /api/usuarios/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }
  return NextResponse.json(toUserPublic(user))
}

// PUT /api/usuarios/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const selfId = request.headers.get('x-user-id')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { password, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }

  // Se tentando desativar a si mesmo
  if (selfId === id && parsed.data.ativo === false) {
    return NextResponse.json(
      { error: 'Não é possível desativar sua própria conta' },
      { status: 400 },
    )
  }

  if (password) {
    data.passwordHash = await hashPassword(password)
  }

  const user = await prisma.user.update({ where: { id }, data })
  return NextResponse.json(toUserPublic(user))
}

// DELETE /api/usuarios/:id — soft delete (ativo = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const selfId = request.headers.get('x-user-id')

  if (selfId === id) {
    return NextResponse.json(
      { error: 'Não é possível desativar sua própria conta' },
      { status: 400 },
    )
  }

  await prisma.user.update({ where: { id }, data: { ativo: false } })
  return NextResponse.json({ success: true })
}
