import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatusConexao } from '@/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    RESEND_API_KEY: 're_test_key',
    NOTIFICATION_EMAIL_TO: 'admin@thamyshoes.com.br',
    ADMIN_EMAIL: 'admin@thamyshoes.com.br',
    NEXT_PUBLIC_APP_URL: 'https://app.thamyshoes.com.br',
  },
}))

const mockSendEmail = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSendEmail },
  })),
}))

const mockPrisma = {
  blingConnection: {
    findFirst: vi.fn(),
  },
  notificacaoLog: {
    count: vi.fn(),
    create: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// Importar depois dos mocks
const { NotificationService } = await import('../notification-service')
const { getTokenExpiringTemplate, getTokenExpiredTemplate } = await import('../email-templates')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConnection(daysFromNow: number) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + daysFromNow)
  return {
    id: 'conn-1',
    status: StatusConexao.CONECTADO,
    accessToken: 'enc:token',
    refreshToken: 'enc:refresh',
    expiresAt,
    connectedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationService.verificarTokenBling', () => {
  let service: InstanceType<typeof NotificationService>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSendEmail.mockResolvedValue({ data: { id: 'email-1' }, error: null })
    mockPrisma.notificacaoLog.count.mockResolvedValue(0)
    mockPrisma.notificacaoLog.create.mockResolvedValue({})
    service = new NotificationService()
  })

  it('token expira em 5 dias → envia TOKEN_EXPIRING_SOON', async () => {
    mockPrisma.blingConnection.findFirst.mockResolvedValue(makeConnection(5))

    const resultado = await service.verificarTokenBling()

    expect(resultado.alertaEnviado).toBe(true)
    expect(resultado.diasRestantes).toBe(5)
    expect(mockSendEmail).toHaveBeenCalledOnce()
    const call = mockSendEmail.mock.calls[0][0] as { subject: string }
    expect(call.subject).toContain('5 dia')
    expect(mockPrisma.notificacaoLog.create).toHaveBeenCalledWith({
      data: { tipo: 'TOKEN_EXPIRING_SOON', destinatario: 'admin@thamyshoes.com.br' },
    })
  })

  it('token já expirou → envia TOKEN_EXPIRED', async () => {
    mockPrisma.blingConnection.findFirst.mockResolvedValue(makeConnection(-1))

    const resultado = await service.verificarTokenBling()

    expect(resultado.alertaEnviado).toBe(true)
    expect(resultado.diasRestantes).toBeLessThanOrEqual(0)
    expect(mockSendEmail).toHaveBeenCalledOnce()
    const call = mockSendEmail.mock.calls[0][0] as { subject: string }
    expect(call.subject).toContain('URGENTE')
    expect(mockPrisma.notificacaoLog.create).toHaveBeenCalledWith({
      data: { tipo: 'TOKEN_EXPIRED', destinatario: 'admin@thamyshoes.com.br' },
    })
  })

  it('token expira em 15 dias → não envia', async () => {
    mockPrisma.blingConnection.findFirst.mockResolvedValue(makeConnection(15))

    const resultado = await service.verificarTokenBling()

    expect(resultado.alertaEnviado).toBe(false)
    expect(resultado.diasRestantes).toBe(15)
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockPrisma.notificacaoLog.create).not.toHaveBeenCalled()
  })

  it('sem conexão Bling → não envia', async () => {
    mockPrisma.blingConnection.findFirst.mockResolvedValue(null)

    const resultado = await service.verificarTokenBling()

    expect(resultado.alertaEnviado).toBe(false)
    expect(resultado.diasRestantes).toBeNull()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('já notificou hoje → não reenvia (deduplicação)', async () => {
    mockPrisma.blingConnection.findFirst.mockResolvedValue(makeConnection(3))
    mockPrisma.notificacaoLog.count.mockResolvedValue(1)

    const resultado = await service.verificarTokenBling()

    expect(resultado.alertaEnviado).toBe(false)
    expect(resultado.diasRestantes).toBe(3)
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockPrisma.notificacaoLog.create).not.toHaveBeenCalled()
  })
})

describe('Cron route — autenticação', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret-abcdef'
  })

  it('cron GET sem Authorization retorna 401 (Vercel Cron)', async () => {
    const { GET } = await import('@/app/api/cron/check-bling-token/route')
    const req = new Request('http://localhost/api/cron/check-bling-token', { method: 'GET' })
    const res = await GET(req as Parameters<typeof GET>[0])
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Unauthorized')
  })

  it('cron POST sem Authorization retorna 401 (chamada manual)', async () => {
    const { POST } = await import('@/app/api/cron/check-bling-token/route')
    const req = new Request('http://localhost/api/cron/check-bling-token', { method: 'POST' })
    const res = await POST(req as Parameters<typeof POST>[0])
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Unauthorized')
  })
})

describe('Email templates', () => {
  it('getTokenExpiringTemplate renderiza HTML com dias e link', () => {
    const tpl = getTokenExpiringTemplate(5, 'https://app.example.com')
    expect(tpl.subject).toContain('5 dia')
    expect(tpl.html).toContain('https://app.example.com/configuracoes/bling')
    expect(tpl.html).toContain('<!DOCTYPE html>')
    expect(tpl.html).toContain('5')
  })

  it('getTokenExpiredTemplate renderiza HTML urgente com link', () => {
    const tpl = getTokenExpiredTemplate('https://app.example.com')
    expect(tpl.subject).toContain('URGENTE')
    expect(tpl.html).toContain('https://app.example.com/configuracoes/bling')
    expect(tpl.html).toContain('expirou')
  })
})
