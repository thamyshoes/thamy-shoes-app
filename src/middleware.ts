import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { env } from '@/lib/env'
import { TIMING } from '@/lib/constants'
import type { UserSession } from '@/types'
import { Perfil } from '@/types'

const JWT_COOKIE = 'auth-token'
const ACTIVITY_COOKIE = 'last-activity'

// ── Rotas públicas ─────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/forgot',
  '/api/auth/reset',
  '/api/health',
  '/api/cron/',
  '/api/bling/callback',
  '/_next/',
  '/favicon.ico',
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

// ── Proteção por perfil ────────────────────────────────────────────────────────

function requiresAdmin(pathname: string): boolean {
  return (
    pathname.startsWith('/pedidos/importar') ||
    pathname.startsWith('/configuracoes') ||
    pathname.startsWith('/mapeamento-sku') ||
    pathname.startsWith('/usuarios') ||
    pathname.startsWith('/api/usuarios') ||
    pathname.startsWith('/api/configuracoes') ||
    pathname.startsWith('/api/bling/')
  )
}

function requiresAdminOrPCP(pathname: string): boolean {
  return (
    pathname.startsWith('/pedidos') ||
    pathname.startsWith('/api/pedidos') ||
    pathname.startsWith('/api/fichas/gerar') ||
    pathname.startsWith('/api/fichas/consolidar') ||
    pathname.startsWith('/api/consolidar')
  )
}

// ── JWT verification ───────────────────────────────────────────────────────────

async function verifyJwt(token: string): Promise<UserSession | null> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return {
      id: payload.id as string,
      email: payload.email as string,
      nome: payload.nome as string,
      perfil: payload.perfil as UserSession['perfil'],
      setor: (payload.setor ?? null) as UserSession['setor'],
    }
  } catch {
    return null
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith('/api/')

  // Request tracing
  const requestId = crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  if (process.env.NODE_ENV === 'development') {
    console.log(`[${requestId.slice(0, 8)}] ${request.method} ${pathname}`)
  }

  // Public routes bypass
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('x-request-id', requestId)
    return response
  }

  // Extract token
  const token = request.cookies.get(JWT_COOKIE)?.value
  const loginUrl = new URL('/login', request.url)

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(loginUrl)
  }

  // Verify JWT
  const user = await verifyJwt(token)
  if (!user) {
    const response = isApiRoute
      ? NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
      : NextResponse.redirect(loginUrl)
    response.cookies.set(JWT_COOKIE, '', { maxAge: 0, path: '/' })
    return response
  }

  // Inactivity timeout: check last-activity cookie
  const lastActivity = request.cookies.get(ACTIVITY_COOKIE)?.value
  const now = Date.now()

  if (lastActivity) {
    const elapsed = now - parseInt(lastActivity, 10)
    const timeoutMs = TIMING.SESSION_TIMEOUT_MIN * 60 * 1000
    if (elapsed > timeoutMs) {
      const response = isApiRoute
        ? NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
        : NextResponse.redirect(loginUrl)
      response.cookies.set(JWT_COOKIE, '', { maxAge: 0, path: '/' })
      response.cookies.set(ACTIVITY_COOKIE, '', { maxAge: 0, path: '/' })
      return response
    }
  }

  // RBAC checks
  if (requiresAdmin(pathname) && user.perfil !== Perfil.ADMIN) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/fichas', request.url))
  }

  if (
    requiresAdminOrPCP(pathname) &&
    user.perfil !== Perfil.ADMIN &&
    user.perfil !== Perfil.PCP
  ) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/fichas', request.url))
  }

  // Attach user headers and refresh activity cookie
  requestHeaders.set('x-user-id', user.id)
  requestHeaders.set('x-user-perfil', user.perfil)
  if (user.setor) requestHeaders.set('x-user-setor', user.setor)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('x-request-id', requestId)
  response.cookies.set(ACTIVITY_COOKIE, String(now), {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: TIMING.SESSION_TIMEOUT_MIN * 60,
  })

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
