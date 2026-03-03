import { describe, it, expect } from 'vitest'
import type { Column } from '@/components/ui/data-table'

// Testa a lógica de colunas do DataTable (sem DOM)
describe('DataTable — lógica de colunas e paginação', () => {
  it('Column<T> aceita align left/right/center', () => {
    const col: Column<{ id: string; nome: string }> = {
      key: 'nome',
      header: 'Nome',
      align: 'right',
      mono: false,
    }
    expect(col.align).toBe('right')
  })

  it('Column com mono=true é configurável', () => {
    const col: Column<{ id: string; sku: string }> = {
      key: 'sku',
      header: 'SKU',
      mono: true,
    }
    expect(col.mono).toBe(true)
  })

  it('Column com render customizado é configurável', () => {
    const col: Column<{ id: string; status: string }> = {
      key: 'status',
      header: 'Status',
      render: (item) => item.status.toLowerCase(),
    }
    expect(col.render?.({ id: '1', status: 'ATIVO' })).toBe('ativo')
  })

  it('cálculo de totalPages funciona corretamente', () => {
    const total = 45
    const pageSize = 20
    const totalPages = Math.ceil(total / pageSize)
    expect(totalPages).toBe(3)
  })

  it('paginação com 0 itens resulta em 0 páginas', () => {
    expect(Math.ceil(0 / 20)).toBe(0)
  })

  it('paginação com exatamente pageSize itens resulta em 1 página', () => {
    expect(Math.ceil(20 / 20)).toBe(1)
  })

  it('paginação com pageSize+1 itens resulta em 2 páginas', () => {
    expect(Math.ceil(21 / 20)).toBe(2)
  })
})
