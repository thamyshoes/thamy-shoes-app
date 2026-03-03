import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'
import { forgotPasswordSchema } from '@/lib/validators'
import { generateResetToken } from '@/lib/password-reset'
import { NotificationService } from '@/lib/notifications/notification-service'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const rl = rateLimit(`password-reset:${ip}`, RATE_LIMIT_CONFIGS.passwordReset)
  if (!rl.success) {
    const retryAfter = Math.ceil((rl.reset.getTime() - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const { email } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.ativo) {
    return NextResponse.json({ ok: true })
  }

  const { token, tokenHash } = generateResetToken()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  const notifications = new NotificationService()
  await notifications.sendPasswordReset(user.email, token)

  return NextResponse.json({ ok: true })
}
