import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockGenerateSignedUrl = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/api-guard', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/services/storage-service', () => ({
  StorageService: {
    generateSignedUrl: (...args: unknown[]) => mockGenerateSignedUrl(...args),
    getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
  },
  StorageServiceError: class StorageServiceError extends Error {},
}))

import { POST } from '../route'
import { requireAdmin } from '@/lib/api-guard'
import { StorageServiceError } from '@/lib/services/storage-service'

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/variantes/signed-url', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/variantes/signed-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockReturnValue(null)
  })

  it('retorna 403 quando usuário não é admin', async () => {
    const forbidden = NextResponse.json(
      { error: 'Acesso restrito a administradores' },
      { status: 403 },
    )
    vi.mocked(requireAdmin).mockReturnValue(forbidden)

    const req = buildRequest({ fileName: 'foto.jpg', contentType: 'image/jpeg' })
    const res = await POST(req)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Acesso restrito a administradores')
  })

  it('retorna 400 quando body é inválido (fileName ausente)', async () => {
    const req = buildRequest({ contentType: 'image/jpeg' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('retorna 400 quando contentType não é permitido', async () => {
    const req = buildRequest({ fileName: 'doc.pdf', contentType: 'application/pdf' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('retorna 200 com signedUrl, path e publicUrl no sucesso', async () => {
    mockGenerateSignedUrl.mockResolvedValue({
      signedUrl: 'https://storage.example.com/signed?token=abc',
      path: 'variantes/1234-foto.jpg',
    })
    mockGetPublicUrl.mockReturnValue('https://storage.example.com/public/variantes/1234-foto.jpg')

    const req = buildRequest({ fileName: 'foto.jpg', contentType: 'image/jpeg' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.signedUrl).toBe('https://storage.example.com/signed?token=abc')
    expect(json.path).toBe('variantes/1234-foto.jpg')
    expect(json.publicUrl).toBe('https://storage.example.com/public/variantes/1234-foto.jpg')
    expect(mockGenerateSignedUrl).toHaveBeenCalledWith('foto.jpg', 'image/jpeg')
    expect(mockGetPublicUrl).toHaveBeenCalledWith('variantes/1234-foto.jpg')
  })

  it('retorna 500 quando StorageService lança StorageServiceError', async () => {
    mockGenerateSignedUrl.mockRejectedValue(new StorageServiceError('falha no storage'))

    const req = buildRequest({ fileName: 'foto.jpg', contentType: 'image/png' })
    const res = await POST(req)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('falha no storage')
  })
})
