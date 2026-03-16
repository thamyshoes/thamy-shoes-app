import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'
import {
  verifyPassword,
  generateToken,
  setAuthCookie,
} from '@/lib/auth'
import { loginSchema } from '@/lib/validators'
import type { UserSession } from '@/types'

export async function POST(request: NextRequest) {
  // 1. Validar body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { email, password } = parsed.data

  // 2. Rate limiting por IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const rl = rateLimit(`login:${ip}`, RATE_LIMIT_CONFIGS.login)

  if (!rl.success) {
    const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    )
  }

  // 3. Buscar usuário
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    return NextResponse.json(
      { error: 'Credenciais inválidas' },
      { status: 401 },
    )
  }

  // 4. Conta ativa
  if (!user.ativo) {
    return NextResponse.json({ error: 'Conta desativada' }, { status: 401 })
  }

  // 5. Verificar senha
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json(
      { error: 'Credenciais inválidas' },
      { status: 401 },
    )
  }

  // 6. Gerar token e setar cookie
  const session: UserSession = {
    id: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
    setores: user.setores,
  }

  const token = await generateToken(session)
  await setAuthCookie(token)

  return NextResponse.json({ user: session })
}
