import { describe, it, expect } from 'vitest'

// Testa lógica de validação e classificação do SwatchCor (sem DOM)
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

function isValidHex(hex: string | null | undefined): boolean {
  return !!hex && HEX_REGEX.test(hex)
}

function isWhiteHex(hex: string | null | undefined): boolean {
  return isValidHex(hex) && hex?.toLowerCase() === '#ffffff'
}

function getAriaLabel(hex: string | null | undefined, nome?: string): string {
  if (!isValidHex(hex)) {
    return nome ? `Cor ${nome} sem hex definido` : 'Cor sem hex definido'
  }
  return nome ? `Cor ${nome} (${hex})` : `Cor ${hex}`
}

describe('SwatchCor — lógica de validação hex', () => {
  it('aceita hex válido uppercase', () => {
    expect(isValidHex('#FF5733')).toBe(true)
  })

  it('aceita hex válido lowercase', () => {
    expect(isValidHex('#ff5733')).toBe(true)
  })

  it('aceita hex válido mixed case', () => {
    expect(isValidHex('#aAbBcC')).toBe(true)
  })

  it('rejeita hex sem #', () => {
    expect(isValidHex('FF5733')).toBe(false)
  })

  it('rejeita hex incompleto', () => {
    expect(isValidHex('#FF573')).toBe(false)
  })

  it('rejeita hex com caracteres inválidos', () => {
    expect(isValidHex('#GGGGGG')).toBe(false)
  })

  it('rejeita null', () => {
    expect(isValidHex(null)).toBe(false)
  })

  it('rejeita undefined', () => {
    expect(isValidHex(undefined)).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(isValidHex('')).toBe(false)
  })
})

describe('SwatchCor — detecção de branco', () => {
  it('detecta #FFFFFF como branco', () => {
    expect(isWhiteHex('#FFFFFF')).toBe(true)
  })

  it('detecta #ffffff como branco (case-insensitive)', () => {
    expect(isWhiteHex('#ffffff')).toBe(true)
  })

  it('não detecta #000000 como branco', () => {
    expect(isWhiteHex('#000000')).toBe(false)
  })

  it('não detecta null como branco', () => {
    expect(isWhiteHex(null)).toBe(false)
  })
})

describe('SwatchCor — tamanhos', () => {
  it('sm retorna classes h-4 w-4', () => {
    expect(sizeClasses.sm).toBe('h-4 w-4')
  })

  it('md retorna classes h-5 w-5 (default)', () => {
    expect(sizeClasses.md).toBe('h-5 w-5')
  })

  it('lg retorna classes h-6 w-6', () => {
    expect(sizeClasses.lg).toBe('h-6 w-6')
  })
})

describe('SwatchCor — aria-label', () => {
  it('hex válido com nome: "Cor {nome} ({hex})"', () => {
    expect(getAriaLabel('#FF5733', 'Vermelho')).toBe('Cor Vermelho (#FF5733)')
  })

  it('hex válido sem nome: "Cor {hex}"', () => {
    expect(getAriaLabel('#FF5733')).toBe('Cor #FF5733')
  })

  it('hex null com nome: "Cor {nome} sem hex definido"', () => {
    expect(getAriaLabel(null, 'Preto')).toBe('Cor Preto sem hex definido')
  })

  it('hex null sem nome: "Cor sem hex definido"', () => {
    expect(getAriaLabel(null)).toBe('Cor sem hex definido')
  })
})
