import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StatusItem } from '@/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  regraSkU: { findFirst: vi.fn() },
  mapeamentoCor: { findMany: vi.fn(), upsert: vi.fn() },
  itemPedido: { findMany: vi.fn(), update: vi.fn() },
  gradeModelo: { findMany: vi.fn() },
  produto: { findMany: vi.fn() },
  modelo: { findMany: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// Importar depois dos mocks + invalidar cache entre testes
const { parseSku, interpretarItens, montarGrades, montarGradesConsolidadas, invalidarCacheRegra } =
  await import('../sku-parser')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRegra(separador = '-', ordem = ['modelo', 'cor', 'tamanho']) {
  return { id: '1', separador, ordem, ativa: true }
}

function makeItem(overrides: Partial<{
  id: string
  pedidoId: string
  skuBruto: string
  quantidade: number
  modelo: string | null
  cor: string | null
  corDescricao: string | null
  tamanho: number | null
  status: typeof StatusItem[keyof typeof StatusItem]
}> = {}) {
  return {
    id: 'item-1',
    pedidoId: 'pedido-1',
    descricaoBruta: 'Produto',
    skuBruto: 'REF001-PT-38',
    quantidade: 10,
    unidade: 'UN',
    modelo: null,
    cor: null,
    corDescricao: null,
    tamanho: null,
    variacoes: null,
    produtoId: null,
    modeloId: null,
    status: StatusItem.PENDENTE,
    createdAt: new Date(),
    ...overrides,
  }
}

// ── parseSku ──────────────────────────────────────────────────────────────────

describe('parseSku', () => {
  beforeEach(() => {
    invalidarCacheRegra()
    vi.clearAllMocks()
  })

  it('retorna RESOLVIDO para SKU completo (separador "-")', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeRegra('-', ['modelo', 'cor', 'tamanho']))
    const r = await parseSku('REF001-PT-38')
    expect(r).toEqual({ modelo: 'REF001', cor: 'PT', tamanho: '38', status: 'RESOLVIDO' })
  })

  it('retorna PENDENTE para SKU sem tamanho', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeRegra('-', ['modelo', 'cor', 'tamanho']))
    const r = await parseSku('REF001-PT')
    expect(r).toEqual({ modelo: 'REF001', cor: 'PT', tamanho: null, status: 'PENDENTE' })
  })

  it('retorna PENDENTE para SKU vazio', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeRegra())
    const r = await parseSku('')
    expect(r).toEqual({ modelo: null, cor: null, tamanho: null, status: 'PENDENTE' })
  })

  it('retorna PENDENTE quando não há regra ativa', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(null)
    const r = await parseSku('REF001-PT-38')
    expect(r).toEqual({ modelo: null, cor: null, tamanho: null, status: 'PENDENTE' })
  })

  it('suporta separador "/" diferente', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeRegra('/', ['modelo', 'cor', 'tamanho']))
    const r = await parseSku('REF001/PT/38')
    expect(r).toEqual({ modelo: 'REF001', cor: 'PT', tamanho: '38', status: 'RESOLVIDO' })
  })

  it('suporta ordem diferente: ["tamanho","cor","modelo"]', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeRegra('-', ['tamanho', 'cor', 'modelo']))
    const r = await parseSku('38-PT-REF001')
    expect(r).toEqual({ modelo: 'REF001', cor: 'PT', tamanho: '38', status: 'RESOLVIDO' })
  })

  // ── SUFIXO mode: validação de tamanho numérico ──────────────────────────

  function makeSufixoRegra() {
    return {
      id: '1',
      modo: 'SUFIXO',
      separador: '',
      ordem: ['modelo', 'cor', 'tamanho'],
      digitosSufixo: [
        { campo: 'tamanho', digitos: 2 },
        { campo: 'cor', digitos: 3 },
      ],
      ativa: true,
    }
  }

  it('SUFIXO: resolve SKU padrão 307000627 → modelo=3070', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeSufixoRegra())
    const r = await parseSku('307000627')
    expect(r).toEqual({ modelo: '3070', cor: '006', tamanho: '27', status: 'RESOLVIDO' })
  })

  it('SUFIXO: resolve SKU padrão 805400130 → modelo=8054', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeSufixoRegra())
    const r = await parseSku('805400130')
    expect(r).toEqual({ modelo: '8054', cor: '001', tamanho: '30', status: 'RESOLVIDO' })
  })

  it('SUFIXO: rejeita SKU com letra no tamanho (805400131b) → PENDENTE', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeSufixoRegra())
    const r = await parseSku('805400131b')
    expect(r).toEqual({ modelo: null, cor: null, tamanho: null, status: 'PENDENTE' })
  })

  it('SUFIXO: rejeita SKU com cor não-numérica (307000624bm02) → PENDENTE', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeSufixoRegra())
    // cor extraída = '4bm' (não-numérica) → PENDENTE
    const r = await parseSku('307000624bm02')
    expect(r).toEqual({ modelo: null, cor: null, tamanho: null, status: 'PENDENTE' })
  })

  it('SUFIXO: rejeita SKU com tamanho não-numérico (805413228b) → PENDENTE', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeSufixoRegra())
    // tamanho extraído = '8b' (não-numérico) → PENDENTE
    const r = await parseSku('805413228b')
    expect(r).toEqual({ modelo: null, cor: null, tamanho: null, status: 'PENDENTE' })
  })

  it('SUFIXO: rejeita SKU curto (3070, 4 chars) → PENDENTE', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeSufixoRegra())
    const r = await parseSku('3070')
    expect(r).toEqual({ modelo: null, cor: null, tamanho: null, status: 'PENDENTE' })
  })

  it('SUFIXO: diferencia 3070 de 3070B corretamente', async () => {
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeSufixoRegra())
    const r1 = await parseSku('307000627')
    const r2 = await parseSku('3070B00627')
    expect(r1.modelo).toBe('3070')
    expect(r2.modelo).toBe('3070B')
    expect(r1.modelo).not.toBe(r2.modelo)
  })
})

// ── interpretarItens ──────────────────────────────────────────────────────────

describe('interpretarItens', () => {
  beforeEach(() => {
    invalidarCacheRegra()
    vi.clearAllMocks()
    mockPrisma.regraSkU.findFirst.mockResolvedValue(makeRegra())
    mockPrisma.itemPedido.update.mockResolvedValue({})
    mockPrisma.produto.findMany.mockResolvedValue([])
    mockPrisma.modelo.findMany.mockResolvedValue([])
    mockPrisma.mapeamentoCor.upsert.mockResolvedValue({})
  })

  it('retorna lista vazia para itens vazios', async () => {
    const r = await interpretarItens([])
    expect(r).toEqual([])
  })

  it('mapeia cor com descricao encontrada no banco', async () => {
    mockPrisma.mapeamentoCor.findMany.mockResolvedValue([
      { id: '1', codigo: 'PT', descricao: 'Preto', createdAt: new Date() },
    ])
    const itens = [makeItem({ skuBruto: 'REF001-PT-38' })]
    const r = await interpretarItens(itens)
    expect(r[0]).toMatchObject({ modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: '38' })
  })

  it('usa codigo bruto como descricao quando cor não mapeada', async () => {
    mockPrisma.mapeamentoCor.findMany.mockResolvedValue([])
    const itens = [makeItem({ skuBruto: 'REF001-XX-38' })]
    const r = await interpretarItens(itens)
    expect(r[0]).toMatchObject({ cor: 'XX', corDescricao: 'XX' })
  })

  it('exclui itens PENDENTE do retorno', async () => {
    mockPrisma.mapeamentoCor.findMany.mockResolvedValue([])
    const itens = [makeItem({ skuBruto: 'REF001-PT' })] // sem tamanho → PENDENTE
    const r = await interpretarItens(itens)
    expect(r).toHaveLength(0)
  })
})

// ── montarGrades ──────────────────────────────────────────────────────────────

describe('montarGrades', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.gradeModelo.findMany.mockResolvedValue([])
    mockPrisma.modelo.findMany.mockResolvedValue([])
  })

  it('retorna lista vazia se sem itens RESOLVIDOS', async () => {
    mockPrisma.itemPedido.findMany.mockResolvedValue([])
    const r = await montarGrades('pedido-1')
    expect(r).toEqual([])
  })

  it('agrupa 3 tamanhos do mesmo modelo/cor em 1 GradeRow', async () => {
    mockPrisma.itemPedido.findMany.mockResolvedValue([
      makeItem({ id: '1', modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: 36, quantidade: 10, status: StatusItem.RESOLVIDO }),
      makeItem({ id: '2', modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: 37, quantidade: 15, status: StatusItem.RESOLVIDO }),
      makeItem({ id: '3', modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: 38, quantidade: 20, status: StatusItem.RESOLVIDO }),
    ])
    const r = await montarGrades('pedido-1')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      modelo: 'REF001',
      cor: 'PT',
      corDescricao: 'Preto',
      tamanhos: { '36': 10, '37': 15, '38': 20 },
      totalPares: 45,
    })
  })

  it('gera 2 GradeRows para 2 cores diferentes', async () => {
    mockPrisma.itemPedido.findMany.mockResolvedValue([
      makeItem({ id: '1', modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: 38, quantidade: 10, status: StatusItem.RESOLVIDO }),
      makeItem({ id: '2', modelo: 'REF001', cor: 'BG', corDescricao: 'Bege', tamanho: 38, quantidade: 5, status: StatusItem.RESOLVIDO }),
    ])
    const r = await montarGrades('pedido-1')
    expect(r).toHaveLength(2)
    const cores = r.map((row) => row.cor).sort()
    expect(cores).toEqual(['BG', 'PT'])
  })

  it('usa range da GradeNumeracao quando modelo tem grade associada', async () => {
    mockPrisma.gradeModelo.findMany.mockResolvedValue([
      {
        id: 'gm1',
        modelo: 'REF001',
        gradeId: 'g1',
        createdAt: new Date(),
        grade: { id: 'g1', nome: 'Grade 36-38', tamanhoMin: 36, tamanhoMax: 38, createdAt: new Date(), updatedAt: new Date() },
      },
    ])
    mockPrisma.itemPedido.findMany.mockResolvedValue([
      makeItem({ id: '1', modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: 37, quantidade: 10, status: StatusItem.RESOLVIDO }),
    ])
    const r = await montarGrades('pedido-1')
    // Range 36-38 → colunas 36, 37, 38; apenas 37 tem valor
    expect(r[0]!.tamanhos).toEqual({ '36': 0, '37': 10, '38': 0 })
  })
})

// ── montarGradesConsolidadas ──────────────────────────────────────────────────

describe('montarGradesConsolidadas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.gradeModelo.findMany.mockResolvedValue([])
    mockPrisma.modelo.findMany.mockResolvedValue([])
  })

  it('retorna [] para lista vazia de pedidoIds', async () => {
    const r = await montarGradesConsolidadas([])
    expect(r).toEqual([])
  })

  it('soma quantidades de dois pedidos para o mesmo modelo/cor/tamanho', async () => {
    mockPrisma.itemPedido.findMany.mockResolvedValue([
      makeItem({ id: '1', pedidoId: 'A', modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: 36, quantidade: 10, status: StatusItem.RESOLVIDO }),
      makeItem({ id: '2', pedidoId: 'B', modelo: 'REF001', cor: 'PT', corDescricao: 'Preto', tamanho: 36, quantidade: 5, status: StatusItem.RESOLVIDO }),
    ])
    const r = await montarGradesConsolidadas(['A', 'B'])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      modelo: 'REF001',
      cor: 'PT',
      tamanhos: { '36': 15 },
      totalPares: 15,
    })
  })
})
