import { NextRequest, NextResponse } from 'next/server'

type Perfil = 'ADMIN' | 'PCP' | 'PRODUCAO'

function getPerfil(request: NextRequest): Perfil | null {
  const raw = request.headers.get('x-user-perfil')
  if (!raw) return null
  if (raw === 'ADMIN' || raw === 'PCP' || raw === 'PRODUCAO') return raw
  return null
}

/**
 * Verifica se o request vem de um usuario ADMIN.
 * Retorna NextResponse de erro se nao autorizado, ou null se OK.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const perfil = getPerfil(request)
  if (!perfil) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (perfil !== 'ADMIN') {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
  }
  return null
}

/**
 * Autoriza ADMIN ou PCP. Usado em endpoints de gestao de SKU
 * (modelos, cores, numeracao, regras, equivalencias, referencias, variantes).
 */
export function requireAdminOrPCP(request: NextRequest): NextResponse | null {
  const perfil = getPerfil(request)
  if (!perfil) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (perfil !== 'ADMIN' && perfil !== 'PCP') {
    return NextResponse.json({ error: 'Acesso restrito a administradores e PCP' }, { status: 403 })
  }
  return null
}

/**
 * Autoriza qualquer um dos perfis informados.
 */
export function requirePerfis(
  request: NextRequest,
  perfisPermitidos: Perfil[],
): NextResponse | null {
  const perfil = getPerfil(request)
  if (!perfil) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!perfisPermitidos.includes(perfil)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  return null
}
