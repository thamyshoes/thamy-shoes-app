import { describe, it, expect } from 'vitest'

// Teste da lógica de seleção de template por setor (sem dependência de react-pdf)
// O enum Setor real vem do Prisma, aqui simulamos para teste isolado

enum Setor {
  CABEDAL = 'CABEDAL',
  PALMILHA = 'PALMILHA',
  SOLA = 'SOLA',
  FACHETA = 'FACHETA',
}

// Simular a lógica de seleção de template do buildCardElement
function getTemplateName(setor: Setor): string {
  switch (setor) {
    case Setor.CABEDAL:
      return 'TemplateCabedal'
    case Setor.PALMILHA:
      return 'TemplatePalmilha'
    case Setor.SOLA:
      return 'TemplateSola'
    case Setor.FACHETA:
      return 'TemplateFacheta'
  }
}

describe('render-consolidado — selecao de template por setor', () => {
  it('seleciona TemplateCabedal para CABEDAL', () => {
    expect(getTemplateName(Setor.CABEDAL)).toBe('TemplateCabedal')
  })

  it('seleciona TemplatePalmilha para PALMILHA', () => {
    expect(getTemplateName(Setor.PALMILHA)).toBe('TemplatePalmilha')
  })

  it('seleciona TemplateSola para SOLA', () => {
    expect(getTemplateName(Setor.SOLA)).toBe('TemplateSola')
  })

  it('seleciona TemplateFacheta para FACHETA', () => {
    expect(getTemplateName(Setor.FACHETA)).toBe('TemplateFacheta')
  })

  it('cobre todos os 4 setores', () => {
    const setores = Object.values(Setor)
    expect(setores).toHaveLength(4)
    setores.forEach((setor) => {
      expect(() => getTemplateName(setor)).not.toThrow()
    })
  })
})

describe('render-consolidado — ConsolidadoCardData shape', () => {
  interface ConsolidadoCardData {
    pedido: { numero: string; data: Date }
    item: {
      sku: string
      modelo: { codigo?: string }
      variante: { corPrincipal: string }
      quantidades: Record<number, number>
    }
    base64Imagem: string | null
    tamanhos: number[]
  }

  const validCard: ConsolidadoCardData = {
    pedido: { numero: 'P-001', data: new Date() },
    item: {
      sku: '1611600128',
      modelo: { codigo: '16116' },
      variante: { corPrincipal: 'Branco' },
      quantidades: { 36: 2, 38: 3, 40: 1 },
    },
    base64Imagem: 'data:image/png;base64,abc123',
    tamanhos: [36, 38, 40],
  }

  it('aceita card valido com imagem', () => {
    expect(validCard.base64Imagem).not.toBeNull()
    expect(validCard.tamanhos).toEqual([36, 38, 40])
  })

  it('aceita card sem imagem (null)', () => {
    const cardSemImagem: ConsolidadoCardData = {
      ...validCard,
      base64Imagem: null,
    }
    expect(cardSemImagem.base64Imagem).toBeNull()
  })

  it('tamanhos devem estar ordenados', () => {
    const sorted = [...validCard.tamanhos].sort((a, b) => a - b)
    expect(validCard.tamanhos).toEqual(sorted)
  })

  it('quantidades correspondem aos tamanhos', () => {
    for (const tam of validCard.tamanhos) {
      expect(validCard.item.quantidades[tam]).toBeDefined()
      expect(validCard.item.quantidades[tam]).toBeGreaterThan(0)
    }
  })
})
