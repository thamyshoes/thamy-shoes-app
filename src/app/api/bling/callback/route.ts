import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/bling/bling-crypto'
import { env } from '@/lib/env'
import { StatusConexao } from '@/types'

export async function GET(request: NextRequest) {
  if (!env.BLING_CLIENT_ID || !env.BLING_CLIENT_SECRET || !env.BLING_REDIRECT_URI) {
    const appUrl = env.NEXT_PUBLIC_APP_URL
    return NextResponse.redirect(`${appUrl}/configuracoes/bling?error=missing_env`)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const stateCookie = request.cookies.get('bling_oauth_state')?.value

  const appUrl = env.NEXT_PUBLIC_APP_URL
  const errorUrl = (msg: string) =>
    `${appUrl}/configuracoes/bling?error=${msg}`
  const successUrl = `${appUrl}/configuracoes/bling?success=connected`

  // CSRF state validation
  if (!state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(errorUrl('invalid_state'))
  }

  if (!code) {
    return NextResponse.redirect(errorUrl('no_code'))
  }

  try {
    // Exchange authorization code for tokens
    const credentials = Buffer.from(
      `${env.BLING_CLIENT_ID}:${env.BLING_CLIENT_SECRET}`,
    ).toString('base64')

    const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.BLING_REDIRECT_URI,
      }),
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(errorUrl('token_exchange_failed'))
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const { access_token, refresh_token, expires_in } = tokenData
    const now = Date.now()
    const expiresAt = new Date(now + expires_in * 1000)
    const refreshTokenExpiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000) // 30 dias

    // Upsert BlingConnection (single-row pattern)
    const existing = await prisma.blingConnection.findFirst()
    const data = {
      accessToken: encrypt(access_token),
      refreshToken: encrypt(refresh_token),
      expiresAt,
      refreshTokenExpiresAt,
      connectedAt: new Date(),
      status: StatusConexao.CONECTADO,
      isRefreshing: false,
      refreshingAt: null,
    }

    if (existing) {
      await prisma.blingConnection.update({ where: { id: existing.id }, data })
    } else {
      await prisma.blingConnection.create({ data })
    }

    const response = NextResponse.redirect(successUrl)
    response.cookies.delete('bling_oauth_state')
    return response
  } catch {
    return NextResponse.redirect(errorUrl('server_error'))
  }
}
