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

// ──────────────────────────────────────────────────────────────────────────────
// Testes das lógicas extraídas das correções P1 e P2
// ──────────────────────────────────────────────────────────────────────────────

// Lógica de descCor extraída da rota (FIX P2)
function descCor(
  corDescMap: Map<string, string>,
  codigo: string | null | undefined,
): string | null {
  return codigo ? (corDescMap.get(codigo) ?? codigo) : null
}

// Lógica de normalização de setores com auto-detecção de FACHETA (FIX P1)
type SetorStr = 'CABEDAL' | 'SOLA' | 'PALMILHA' | 'FACHETA'
function normalizarSetores(
  setoresSolicitados: SetorStr[],
  temFacheta: boolean,
): SetorStr[] {
  const set = new Set<SetorStr>(setoresSolicitados)
  if (temFacheta) set.add('FACHETA')
  return [...set]
}

// Lógica de filtro de cards por setor (parte do FIX P1)
function cardsPorSetor(
  setor: SetorStr,
  cards: Array<{ item: { modelo: { facheta?: string | null } } }>,
) {
  if (setor === 'FACHETA') return cards.filter((c) => !!c.item.modelo.facheta)
  return cards
}

describe('FIX P2 — descCor: resolução de descrição de cor por componente', () => {
  it('retorna descrição quando código está mapeado', () => {
    const map = new Map([['298', 'bordo'], ['001', 'branco']])
    expect(descCor(map, '298')).toBe('bordo')
    expect(descCor(map, '001')).toBe('branco')
  })

  it('retorna o próprio código quando não há mapeamento', () => {
    const map = new Map<string, string>()
    expect(descCor(map, '298')).toBe('298')
  })

  it('retorna null para código null', () => {
    const map = new Map([['298', 'bordo']])
    expect(descCor(map, null)).toBeNull()
  })

  it('retorna null para código undefined', () => {
    const map = new Map([['298', 'bordo']])
    expect(descCor(map, undefined)).toBeNull()
  })

  it('cor de componente diferente da cor principal usa sua própria descrição', () => {
    // Cenário real: corPrincipal='branco', corPalmilha='298' (bordo)
    // Antes do fix: corPalmilhaDesc ficava undefined, template usava 'branco' como fallback
    // Depois do fix: corPalmilhaDesc = descCor(map, '298') = 'bordo'
    const map = new Map([['298', 'bordo'], ['001', 'branco']])
    const corPrincipal = 'branco' // cor da SKU
    const corPalmilha = '298'     // cor específica da palmilha
    const corPalmilhaDesc = descCor(map, corPalmilha)
    expect(corPalmilhaDesc).toBe('bordo')
    expect(corPalmilhaDesc).not.toBe(corPrincipal) // garante que não usa corPrincipal
  })
})

describe('FIX P1 — normalizarSetores: auto-detecção de FACHETA', () => {
  it('adiciona FACHETA automaticamente quando temFacheta=true', () => {
    const result = normalizarSetores(['CABEDAL', 'SOLA', 'PALMILHA'], true)
    expect(result).toContain('FACHETA')
  })

  it('não duplica FACHETA quando já está nos setores e temFacheta=true', () => {
    const result = normalizarSetores(['CABEDAL', 'SOLA', 'PALMILHA', 'FACHETA'], true)
    expect(result.filter((s) => s === 'FACHETA')).toHaveLength(1)
  })

  it('não adiciona FACHETA quando temFacheta=false', () => {
    const result = normalizarSetores(['CABEDAL', 'SOLA', 'PALMILHA'], false)
    expect(result).not.toContain('FACHETA')
  })

  it('preserva setores originais independente de temFacheta', () => {
    const result = normalizarSetores(['CABEDAL', 'SOLA'], true)
    expect(result).toContain('CABEDAL')
    expect(result).toContain('SOLA')
  })
})

describe('FIX P1 — cardsPorSetor: filtro de cards por setor', () => {
  const cardComFacheta = { item: { modelo: { facheta: 'FC-22A' } } }
  const cardSemFacheta = { item: { modelo: { facheta: null } } }
  const cardSemFachetaUndef = { item: { modelo: { facheta: undefined } } }

  it('FACHETA retorna apenas cards com modelo.facheta preenchido', () => {
    const cards = [cardComFacheta, cardSemFacheta, cardSemFachetaUndef]
    const result = cardsPorSetor('FACHETA', cards)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(cardComFacheta)
  })

  it('FACHETA retorna vazio quando nenhum card tem facheta', () => {
    const cards = [cardSemFacheta, cardSemFachetaUndef]
    const result = cardsPorSetor('FACHETA', cards)
    expect(result).toHaveLength(0)
  })

  it('CABEDAL retorna todos os cards sem filtro', () => {
    const cards = [cardComFacheta, cardSemFacheta]
    expect(cardsPorSetor('CABEDAL', cards)).toHaveLength(2)
  })

  it('SOLA retorna todos os cards sem filtro', () => {
    const cards = [cardComFacheta, cardSemFacheta]
    expect(cardsPorSetor('SOLA', cards)).toHaveLength(2)
  })

  it('PALMILHA retorna todos os cards sem filtro', () => {
    const cards = [cardComFacheta, cardSemFacheta]
    expect(cardsPorSetor('PALMILHA', cards)).toHaveLength(2)
  })

  it('totalCards de FACHETA é menor que total global em consolidado misto', () => {
    const cards = [cardComFacheta, cardSemFacheta, cardSemFacheta]
    const totalGlobal = cards.length
    const totalFacheta = cardsPorSetor('FACHETA', cards).length
    expect(totalFacheta).toBeLessThan(totalGlobal)
    expect(totalFacheta).toBe(1)
  })
})
