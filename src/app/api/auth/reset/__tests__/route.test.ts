import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { hashResetToken } from '@/lib/password-reset'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn()
const mockUserUpdate = vi.fn().mockResolvedValue({})
const mockTokenUpdate = vi.fn().mockResolvedValue({})
const mockTransaction = vi.fn().mockResolvedValue([{}, {}])

vi.mock('@/lib/prisma', () => ({
  prisma: {
    passwordResetToken: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockTokenUpdate(...args),
    },
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-new-password'),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

const { POST } = await import('../route')

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const VALID_TOKEN = 'a'.repeat(64)
const VALID_TOKEN_HASH = hashResetToken(VALID_TOKEN)

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/auth/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar 400 para token expirado', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'tok-1',
      tokenHash: VALID_TOKEN_HASH,
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date('2020-01-01'), // expirado
      user: { id: 'user-1' },
    })

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'novaSenha123' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/inválido|expirado/i)
  })

  it('deve retornar 400 para token já utilizado', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'tok-2',
      tokenHash: VALID_TOKEN_HASH,
      userId: 'user-1',
      usedAt: new Date('2025-01-01'), // já usado
      expiresAt: new Date('2030-01-01'),
      user: { id: 'user-1' },
    })

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'novaSenha123' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/inválido|expirado/i)
  })

  it('deve retornar 200 para token válido e atualizar senha', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'tok-3',
      tokenHash: VALID_TOKEN_HASH,
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date('2030-01-01'), // válido
      user: { id: 'user-1' },
    })

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'novaSenha123' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('deve retornar 400 para token inexistente', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'novaSenha123' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/inválido|expirado/i)
  })

  it('deve retornar 400 para senha curta (min 8)', async () => {
    const res = await POST(makeRequest({ token: VALID_TOKEN, password: 'abc' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/mínimo 8/i)
  })

  it('deve retornar 400 para payload inválido', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/reset', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
