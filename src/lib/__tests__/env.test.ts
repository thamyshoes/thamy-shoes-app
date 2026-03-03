import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

// Schema Zod inline para testes isolados (não importa env.ts diretamente
// pois ele faz parse no momento do import com process.env atual)
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BLING_CLIENT_ID: z.string().min(1),
  BLING_CLIENT_SECRET: z.string().min(1),
  BLING_REDIRECT_URI: z.string().url(),
  ENCRYPTION_KEY: z.string().length(64),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  CRON_SECRET: z.string().min(16),
})

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_EXPIRES_IN: '8h',
  BLING_CLIENT_ID: 'client-id',
  BLING_CLIENT_SECRET: 'client-secret',
  BLING_REDIRECT_URI: 'https://example.com/api/bling/callback',
  ENCRYPTION_KEY: 'a'.repeat(64),
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_KEY: 'service-key',
  NEXT_PUBLIC_APP_URL: 'https://example.com',
  RESEND_API_KEY: 're_key',
  ADMIN_EMAIL: 'admin@example.com',
  CRON_SECRET: 'a'.repeat(16),
}

describe('env schema validation', () => {
  it('aceita env vars válidas', () => {
    const result = envSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
  })

  it('rejeita DATABASE_URL inválida (não é URL)', () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: 'nao-e-url' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('DATABASE_URL')
    }
  })

  it('rejeita JWT_SECRET com menos de 32 caracteres', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_SECRET: 'curto' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('JWT_SECRET')
    }
  })

  it('rejeita ENCRYPTION_KEY com tamanho diferente de 64', () => {
    const result = envSchema.safeParse({ ...validEnv, ENCRYPTION_KEY: 'a'.repeat(32) })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('ENCRYPTION_KEY')
    }
  })

  it('rejeita ADMIN_EMAIL inválido', () => {
    const result = envSchema.safeParse({ ...validEnv, ADMIN_EMAIL: 'nao-e-email' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('ADMIN_EMAIL')
    }
  })

  it('rejeita CRON_SECRET com menos de 16 caracteres', () => {
    const result = envSchema.safeParse({ ...validEnv, CRON_SECRET: 'curto' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0])
      expect(fields).toContain('CRON_SECRET')
    }
  })

  it('usa JWT_EXPIRES_IN padrão "8h" se não definido', () => {
    const { JWT_EXPIRES_IN: _, ...rest } = validEnv
    const result = envSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.JWT_EXPIRES_IN).toBe('8h')
    }
  })
})
