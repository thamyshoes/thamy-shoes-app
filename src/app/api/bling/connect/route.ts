import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { env } from '@/lib/env'

export async function GET(req: NextRequest) {
  if (!env.BLING_CLIENT_ID || !env.BLING_CLIENT_SECRET || !env.BLING_REDIRECT_URI) {
    const fallback = `${req.nextUrl.origin}/configuracoes/bling?error=missing_env`
    return NextResponse.redirect(fallback)
  }

  const state = randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.BLING_CLIENT_ID,
    redirect_uri: env.BLING_REDIRECT_URI,
    state,
  })

  const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?${params.toString()}`

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('bling_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutos
    path: '/',
  })

  return response
}
