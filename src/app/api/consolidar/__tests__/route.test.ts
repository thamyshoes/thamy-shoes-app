import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Schema extraído da route para teste isolado (sem dependência de Next.js/Prisma)
const consolidarV2Schema = z.object({
  pedidoIds: z.array(z.string().uuid()).min(1),
  setores: z.array(z.enum(['CABEDAL', 'SOLA', 'PALMILHA', 'FACHETA'])).min(1),
})

// Utilitário extraído para teste
function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  )
}

describe('POST /api/consolidar — consolidarV2Schema', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000'
  const validUuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

  it('aceita corpo valido com 1 pedido e 1 setor', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: [validUuid],
      setores: ['CABEDAL'],
    })
    expect(result.success).toBe(true)
  })

  it('aceita corpo valido com multiplos pedidos e setores', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: [validUuid, validUuid2],
      setores: ['CABEDAL', 'SOLA', 'PALMILHA'],
    })
    expect(result.success).toBe(true)
  })

  it('aceita setor FACHETA', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: [validUuid],
      setores: ['FACHETA'],
    })
    expect(result.success).toBe(true)
  })

  it('rejeita pedidoIds vazio', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: [],
      setores: ['CABEDAL'],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita setores vazio', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: [validUuid],
      setores: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita pedidoId que nao e UUID', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: ['not-a-uuid'],
      setores: ['CABEDAL'],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita setor invalido', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: [validUuid],
      setores: ['INVALIDO'],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita corpo sem pedidoIds', () => {
    const result = consolidarV2Schema.safeParse({
      setores: ['CABEDAL'],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita corpo sem setores', () => {
    const result = consolidarV2Schema.safeParse({
      pedidoIds: [validUuid],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita corpo vazio', () => {
    const result = consolidarV2Schema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('chunkArray — utilitario de chunking', () => {
  it('divide array em chunks do tamanho especificado', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7]
    const chunks = chunkArray(arr, 3)
    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })

  it('retorna array unico quando menor que chunk size', () => {
    const arr = [1, 2, 3]
    const chunks = chunkArray(arr, 20)
    expect(chunks).toEqual([[1, 2, 3]])
  })

  it('divide exatamente quando multiplo', () => {
    const arr = [1, 2, 3, 4, 5, 6]
    const chunks = chunkArray(arr, 3)
    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6]])
  })

  it('retorna array vazio para input vazio', () => {
    const chunks = chunkArray([], 20)
    expect(chunks).toEqual([])
  })

  it('chunk de 20 (tamanho real do consolidado)', () => {
    const arr = Array.from({ length: 45 }, (_, i) => i)
    const chunks = chunkArray(arr, 20)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(20)
    expect(chunks[1]).toHaveLength(20)
    expect(chunks[2]).toHaveLength(5)
  })

  it('chunk de 1 gera arrays individuais', () => {
    const chunks = chunkArray([1, 2, 3], 1)
    expect(chunks).toEqual([[1], [2], [3]])
  })
})
