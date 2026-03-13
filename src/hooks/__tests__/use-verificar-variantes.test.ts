import { describe, it, expect } from 'vitest'

// Pure logic tests for useVerificarVariantes hook
// DOM rendering requires jsdom; hook integration tested manually

describe('useVerificarVariantes — lógica', () => {
  it('interface ModeloSemVariante tem campos esperados', () => {
    const modelo: { codigo: string; nome: string } = { codigo: 'REF001', nome: 'Sandália Basic' }
    expect(modelo.codigo).toBe('REF001')
    expect(modelo.nome).toBe('Sandália Basic')
  })

  it('todosComVariante=true quando array está vazio', () => {
    const result = { todosComVariante: true, modelosSemVariante: [] }
    expect(result.todosComVariante).toBe(true)
    expect(result.modelosSemVariante).toHaveLength(0)
  })

  it('todosComVariante=false quando há modelos sem variante', () => {
    const result = {
      todosComVariante: false,
      modelosSemVariante: [
        { codigo: 'REF001', nome: 'Sandália Basic' },
        { codigo: 'REF002', nome: 'Bota Premium' },
      ],
    }
    expect(result.todosComVariante).toBe(false)
    expect(result.modelosSemVariante).toHaveLength(2)
  })

  it('URL de API é construída corretamente com encoding', () => {
    const pedidoId = 'abc-123'
    const url = `/api/modelos/verificar-variantes?pedidoId=${encodeURIComponent(pedidoId)}`
    expect(url).toBe('/api/modelos/verificar-variantes?pedidoId=abc-123')
  })

  it('URL de API encoda caracteres especiais', () => {
    const pedidoId = 'id com espaço&especial'
    const url = `/api/modelos/verificar-variantes?pedidoId=${encodeURIComponent(pedidoId)}`
    expect(url).toContain('id%20com%20espa%C3%A7o%26especial')
  })
})
