import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Schemas extraídos das routes para teste isolado (sem dependência de Next.js/Prisma)
const createSchema = z.object({
  codigo: z.string().min(1).regex(/^[A-Z0-9]+$/, 'Código deve ser alfanumérico maiúsculo'),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Formato inválido. Use #RRGGBB')
    .optional()
    .nullable()
    .transform((v) => v ?? null),
})

const updateSchema = z.object({
  codigo: z.string().min(1).regex(/^[A-Z0-9]+$/).optional(),
  descricao: z.string().min(1).optional(),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Formato inválido. Use #RRGGBB')
    .optional()
    .nullable()
    .transform((v) => v ?? null),
})

describe('POST /api/cores — createSchema', () => {
  it('aceita corpo completo com hex', () => {
    const result = createSchema.safeParse({ codigo: 'PT', descricao: 'Preto', hex: '#1A1A1A' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hex).toBe('#1A1A1A')
    }
  })

  it('aceita corpo sem hex (opcional)', () => {
    const result = createSchema.safeParse({ codigo: 'BR', descricao: 'Branco' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hex).toBeNull()
    }
  })

  it('aceita hex null e transforma em null', () => {
    const result = createSchema.safeParse({ codigo: 'AM', descricao: 'Amarelo', hex: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hex).toBeNull()
    }
  })

  it('rejeita hex inválido sem #', () => {
    const result = createSchema.safeParse({ codigo: 'VM', descricao: 'Vermelho', hex: 'FF0000' })
    expect(result.success).toBe(false)
  })

  it('rejeita hex incompleto', () => {
    const result = createSchema.safeParse({ codigo: 'VM', descricao: 'Vermelho', hex: '#FF00' })
    expect(result.success).toBe(false)
  })

  it('rejeita código vazio', () => {
    const result = createSchema.safeParse({ codigo: '', descricao: 'Teste' })
    expect(result.success).toBe(false)
  })

  it('rejeita código com lowercase', () => {
    const result = createSchema.safeParse({ codigo: 'pt', descricao: 'Preto' })
    expect(result.success).toBe(false)
  })

  it('rejeita descrição vazia', () => {
    const result = createSchema.safeParse({ codigo: 'PT', descricao: '' })
    expect(result.success).toBe(false)
  })
})

describe('PATCH /api/cores/[id] — updateSchema', () => {
  it('aceita atualização com hex válido', () => {
    const result = updateSchema.safeParse({ hex: '#FF5733' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hex).toBe('#FF5733')
    }
  })

  it('aceita hex null (remover hex)', () => {
    const result = updateSchema.safeParse({ hex: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hex).toBeNull()
    }
  })

  it('aceita atualização parcial sem hex', () => {
    const result = updateSchema.safeParse({ descricao: 'Preto Fosco' })
    expect(result.success).toBe(true)
  })

  it('aceita corpo vazio', () => {
    const result = updateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejeita hex inválido', () => {
    const result = updateSchema.safeParse({ hex: 'vermelho' })
    expect(result.success).toBe(false)
  })

  it('aceita hex lowercase', () => {
    const result = updateSchema.safeParse({ hex: '#ff5733' })
    expect(result.success).toBe(true)
  })

  it('mensagem de erro hex contém #RRGGBB', () => {
    const result = updateSchema.safeParse({ hex: 'bad' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const hexError = result.error.errors.find((e) => e.path.includes('hex'))
      expect(hexError?.message).toContain('#RRGGBB')
    }
  })
})
