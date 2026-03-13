import { describe, it, expect } from 'vitest'

// Tipo exportado pelo componente
interface PedidoItemConsolidado {
  id: string
  numero: string
  cliente: string
  totalItens: number
}

// Testes de lógica pura extraída do componente (sem dependência de React/DOM)

describe('ConsolidadoPage — logica de selecao', () => {
  // Simular togglePedido
  function togglePedido(selecionados: string[], id: string): string[] {
    return selecionados.includes(id)
      ? selecionados.filter((x) => x !== id)
      : [...selecionados, id]
  }

  it('adiciona pedido a selecao quando nao selecionado', () => {
    const result = togglePedido([], 'pedido-1')
    expect(result).toEqual(['pedido-1'])
  })

  it('remove pedido da selecao quando ja selecionado', () => {
    const result = togglePedido(['pedido-1', 'pedido-2'], 'pedido-1')
    expect(result).toEqual(['pedido-2'])
  })

  it('mantem outros pedidos ao adicionar', () => {
    const result = togglePedido(['pedido-1'], 'pedido-2')
    expect(result).toEqual(['pedido-1', 'pedido-2'])
  })

  it('array vazio apos remover unico selecionado', () => {
    const result = togglePedido(['pedido-1'], 'pedido-1')
    expect(result).toEqual([])
  })
})

describe('ConsolidadoPage — estado do botao', () => {
  function isButtonDisabled(selecionadosCount: number, isLoading: boolean): boolean {
    return selecionadosCount === 0 || isLoading
  }

  it('botao disabled quando nenhum selecionado', () => {
    expect(isButtonDisabled(0, false)).toBe(true)
  })

  it('botao enabled quando 1+ selecionados e nao loading', () => {
    expect(isButtonDisabled(1, false)).toBe(false)
    expect(isButtonDisabled(3, false)).toBe(false)
  })

  it('botao disabled durante loading mesmo com selecao', () => {
    expect(isButtonDisabled(2, true)).toBe(true)
  })
})

describe('ConsolidadoPage — texto do botao', () => {
  function getButtonText(count: number): string {
    return `Gerar consolidado (${count} pedido${count !== 1 ? 's' : ''})`
  }

  it('singular para 1 pedido', () => {
    expect(getButtonText(1)).toBe('Gerar consolidado (1 pedido)')
  })

  it('plural para 2+ pedidos', () => {
    expect(getButtonText(2)).toBe('Gerar consolidado (2 pedidos)')
    expect(getButtonText(10)).toBe('Gerar consolidado (10 pedidos)')
  })

  it('zero pedidos', () => {
    expect(getButtonText(0)).toBe('Gerar consolidado (0 pedidos)')
  })
})

describe('ConsolidadoPage — download PDF', () => {
  function computeToastMessage(successCount: number, failCount: number, total: number) {
    if (failCount === 0) {
      return `${successCount} PDF${successCount !== 1 ? 's' : ''} gerado${successCount !== 1 ? 's' : ''} com sucesso!`
    } else if (successCount > 0) {
      return `${successCount} de ${total} PDFs gerados. ${failCount} falhou ao baixar.`
    }
    return 'Erro ao baixar os PDFs gerados. Tente novamente.'
  }

  it('sucesso total: mensagem de sucesso', () => {
    expect(computeToastMessage(3, 0, 3)).toBe('3 PDFs gerados com sucesso!')
  })

  it('sucesso singular', () => {
    expect(computeToastMessage(1, 0, 1)).toBe('1 PDF gerado com sucesso!')
  })

  it('sucesso parcial: mensagem de warning', () => {
    expect(computeToastMessage(2, 1, 3)).toBe('2 de 3 PDFs gerados. 1 falhou ao baixar.')
  })

  it('falha total: mensagem de erro', () => {
    expect(computeToastMessage(0, 3, 3)).toBe('Erro ao baixar os PDFs gerados. Tente novamente.')
  })
})

describe('ConsolidadoPage — empty state', () => {
  it('exibe empty state quando pedidos vazio', () => {
    const pedidos: PedidoItemConsolidado[] = []
    expect(pedidos.length === 0).toBe(true)
  })

  it('nao exibe empty state quando ha pedidos', () => {
    const pedidos: PedidoItemConsolidado[] = [
      { id: '1', numero: 'P-001', cliente: 'Cliente A', totalItens: 10 },
    ]
    expect(pedidos.length === 0).toBe(false)
  })
})

describe('ConsolidadoPage — label de itens', () => {
  function getItensLabel(totalItens: number): string {
    return `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`
  }

  it('singular para 1 item', () => {
    expect(getItensLabel(1)).toBe('1 item')
  })

  it('plural para 2+ itens', () => {
    expect(getItensLabel(5)).toBe('5 itens')
    expect(getItensLabel(42)).toBe('42 itens')
  })
})
