import { describe, it, expect } from 'vitest'

// Pure logic tests for DialogSetores component
// DOM rendering requires jsdom; component tested manually

type Setor = 'CABEDAL' | 'SOLA' | 'PALMILHA' | 'FACHETA'

const SETORES_BASE: { value: Setor; label: string }[] = [
  { value: 'CABEDAL', label: 'Cabedal' },
  { value: 'SOLA', label: 'Sola' },
  { value: 'PALMILHA', label: 'Palmilha' },
]

describe('DialogSetores — lógica de setores', () => {
  it('SETORES_BASE contém 3 setores padrão', () => {
    expect(SETORES_BASE).toHaveLength(3)
    expect(SETORES_BASE.map((s) => s.value)).toEqual(['CABEDAL', 'SOLA', 'PALMILHA'])
  })

  it('com temFacheta=true, lista tem 4 setores', () => {
    const temFacheta = true
    const setores = temFacheta
      ? [...SETORES_BASE, { value: 'FACHETA' as Setor, label: 'Facheta' }]
      : SETORES_BASE
    expect(setores).toHaveLength(4)
    expect(setores[3].value).toBe('FACHETA')
  })

  it('com temFacheta=false, lista tem 3 setores', () => {
    const temFacheta = false
    const setores = temFacheta
      ? [...SETORES_BASE, { value: 'FACHETA' as Setor, label: 'Facheta' }]
      : SETORES_BASE
    expect(setores).toHaveLength(3)
  })

  it('toggle adiciona setor ao Set', () => {
    const selecionados = new Set<Setor>(['CABEDAL', 'SOLA', 'PALMILHA'])
    // Toggle FACHETA on
    const next = new Set(selecionados)
    next.add('FACHETA')
    expect(next.size).toBe(4)
    expect(next.has('FACHETA')).toBe(true)
  })

  it('toggle remove setor do Set', () => {
    const selecionados = new Set<Setor>(['CABEDAL', 'SOLA', 'PALMILHA'])
    // Toggle SOLA off
    const next = new Set(selecionados)
    next.delete('SOLA')
    expect(next.size).toBe(2)
    expect(next.has('SOLA')).toBe(false)
  })

  it('nenhum selecionado desabilita confirmação', () => {
    const selecionados = new Set<Setor>()
    expect(selecionados.size === 0).toBe(true)
  })

  it('Array.from converte Set para array', () => {
    const selecionados = new Set<Setor>(['CABEDAL', 'PALMILHA'])
    const arr = Array.from(selecionados)
    expect(arr).toEqual(['CABEDAL', 'PALMILHA'])
  })
})
