import { NextRequest, NextResponse } from 'next/server'

/**
 * Verifica se o request vem de um usuario ADMIN.
 * Retorna NextResponse de erro se nao autorizado, ou null se OK.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const perfil = request.headers.get('x-user-perfil')
  if (!perfil) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (perfil !== 'ADMIN') return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
  return null
}
