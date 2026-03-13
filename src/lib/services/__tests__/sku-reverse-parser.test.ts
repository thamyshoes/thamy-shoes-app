import { describe, it, expect } from 'vitest'
import { parseSku } from '../sku-reverse-parser'

describe('parseSku', () => {
  it('interpreta SKU padrão: últimos 2 = tamanho, 3 anteriores = cor, restante = modelo', () => {
    expect(parseSku('ABC12300137')).toEqual({
      modelo: 'ABC123',
      cor: '001',
      tamanho: '37',
    })
  })

  it('SKU com menos de 5 chars retorna modelo = SKU, cor/tamanho null', () => {
    expect(parseSku('AB01')).toEqual({ modelo: 'AB01', cor: null, tamanho: null })
  })

  it('SKU com exatamente 5 chars: modelo vazio, cor = 3 primeiros, tamanho = 2 últimos', () => {
    expect(parseSku('00001')).toEqual({ modelo: '', cor: '000', tamanho: '01' })
  })

  it('SKU vazio retorna modelo vazio e cor/tamanho null', () => {
    expect(parseSku('')).toEqual({ modelo: '', cor: null, tamanho: null })
  })

  it('SKU null retorna modelo vazio e cor/tamanho null', () => {
    expect(parseSku(null)).toEqual({ modelo: '', cor: null, tamanho: null })
  })

  it('SKU undefined retorna modelo vazio e cor/tamanho null', () => {
    expect(parseSku(undefined)).toEqual({ modelo: '', cor: null, tamanho: null })
  })

  it('SKU com exatamente 4 chars retorna como shortSku (< 5)', () => {
    expect(parseSku('1234')).toEqual({ modelo: '1234', cor: null, tamanho: null })
  })

  it('interpreta SKU longo corretamente', () => {
    expect(parseSku('MODREF999PT38')).toEqual({
      modelo: 'MODREF99',
      cor: '9PT',
      tamanho: '38',
    })
  })
})
