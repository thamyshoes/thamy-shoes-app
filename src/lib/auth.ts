import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { env } from './env'
import { TIMING } from './constants'
import type { UserSession, UserPublic } from '@/types'
import type { User } from '@prisma/client'

const JWT_COOKIE = 'auth-token'
const BCRYPT_COST = 12

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

// ── User helpers ──────────────────────────────────────────────────────────────

export function toUserPublic(user: User): UserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, ...rest } = user
  return rest
}

// ── Bcrypt ────────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ── JWT ───────────────────────────────────────────────────────────────────────

export async function generateToken(user: UserSession): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
    setor: user.setor,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TIMING.JWT_TTL_H}h`)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
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

// ── Cookie helpers ─────────────────────────────────────────────────────────────

export function getAuthCookieOptions(expires: boolean) {
  return {
    name: JWT_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: expires ? 0 : TIMING.JWT_TTL_H * 3600,
  }
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set({
    ...getAuthCookieOptions(false),
    value: token,
  })
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set({
    ...getAuthCookieOptions(true),
    value: '',
  })
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function getSession(
  request: Request,
): Promise<UserSession | null> {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${JWT_COOKIE}=([^;]+)`))
  if (!match) return null
  return verifyToken(match[1])
}
