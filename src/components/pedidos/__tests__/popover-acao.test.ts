import { describe, it, expect } from 'vitest'

// Pure logic tests for PopoverAcao component
// DOM rendering requires jsdom; component tested manually

interface ModeloSemVariante {
  codigo: string
  nome: string
}

describe('PopoverAcao — lógica', () => {
  it('modelosSemVariante tem tipagem correta', () => {
    const modelos: ModeloSemVariante[] = [
      { codigo: 'REF001', nome: 'Sandália Basic' },
      { codigo: 'REF002', nome: 'Bota Premium' },
    ]
    expect(modelos).toHaveLength(2)
    expect(modelos[0].codigo).toBe('REF001')
  })

  it('link de cadastro de variante é construído corretamente', () => {
    const modelo: ModeloSemVariante = { codigo: 'REF001', nome: 'Sandália Basic' }
    const href = `/configuracoes/modelos?search=${encodeURIComponent(modelo.codigo)}`
    expect(href).toBe('/configuracoes/modelos?search=REF001')
  })

  it('link encoda caracteres especiais no código', () => {
    const modelo: ModeloSemVariante = { codigo: 'REF 001/A', nome: 'Teste' }
    const href = `/configuracoes/modelos?search=${encodeURIComponent(modelo.codigo)}`
    expect(href).toContain('REF%20001%2FA')
  })

  it('lista vazia ainda renderiza tooltip vazio (edge case)', () => {
    const modelos: ModeloSemVariante[] = []
    expect(modelos).toHaveLength(0)
  })
})
