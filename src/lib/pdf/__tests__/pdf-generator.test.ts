import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Setor, StatusPedido } from '@prisma/client'

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock renderConsolidadoPdf (replaces direct @react-pdf/renderer usage)
const mockRenderConsolidadoPdf = vi.fn().mockResolvedValue(Buffer.from('pdf-content'))
vi.mock('@/lib/pdf/render-consolidado', () => ({
  renderConsolidadoPdf: (...args: unknown[]) => mockRenderConsolidadoPdf(...args),
}))

vi.mock('@/lib/services/image-to-base64-converter', () => ({
  imageUrlToBase64: vi.fn().mockResolvedValue(null),
}))

const mockUpload = vi.fn().mockResolvedValue({ error: null })
const mockGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: 'https://storage.example.com/fichas-producao/pedidos/p1/cabedal.pdf' },
})
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        download: vi.fn().mockResolvedValue({
          data: new Blob([Buffer.from('pdf-content')]),
          error: null,
        }),
      }),
    },
  }),
  FICHAS_BUCKET: 'fichas-producao',
}))

let fichaCreateCounter = 0
const mockPrisma = {
  pedidoCompra: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  fichaProducao: {
    findUnique: vi.fn(),
    create: vi.fn().mockImplementation(() => {
      fichaCreateCounter++
      return Promise.resolve({ id: `ficha-${fichaCreateCounter}`, setor: Setor.CABEDAL })
    }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  consolidado: {
    create: vi.fn().mockResolvedValue({ id: 'cons-1' }),
  },
  consolidadoPedido: {
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  },
  modelo: {
    count: vi.fn().mockResolvedValue(0),
  },
  mapeamentoCor: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      fichaProducao: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'ficha-1', setor: Setor.CABEDAL })
          .mockResolvedValueOnce({ id: 'ficha-2', setor: Setor.PALMILHA })
          .mockResolvedValueOnce({ id: 'ficha-3', setor: Setor.SOLA }),
      },
      pedidoCompra: {
        update: vi.fn().mockResolvedValue({}),
      },
      consolidado: {
        create: vi.fn().mockResolvedValue({ id: 'cons-1' }),
      },
      consolidadoPedido: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    }
    return fn(tx)
  }),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/bling/sku-parser', () => ({
  montarGrades: vi.fn().mockResolvedValue([
    { modelo: 'BASICO', cor: '01', corDescricao: 'Preto', tamanhos: { '36': 2, '37': 3 }, totalPares: 5 },
  ]),
  montarGradesConsolidadas: vi.fn().mockResolvedValue([
    { modelo: 'BASICO', cor: '01', corDescricao: 'Preto', tamanhos: { '36': 4, '37': 6 }, totalPares: 10 },
  ]),
}))

// ── Importar após mocks ────────────────────────────────────────────────────────

const { PdfGeneratorService } = await import('../pdf-generator')

// ── Dados de fixture ──────────────────────────────────────────────────────────

const pedidoResolvido = {
  id: 'p1',
  numero: 'PED-001',
  dataEmissao: new Date('2024-01-01'),
  fornecedorNome: 'Fornecedor X',
  status: StatusPedido.IMPORTADO,
  itens: [{ id: 'i1', status: 'RESOLVIDO', modelo: 'BASICO' }],
}

// ─────────────────────────────────────────────────────────────────────────────

describe('PdfGeneratorService', () => {
  let service: InstanceType<typeof PdfGeneratorService>

  beforeEach(() => {
    vi.clearAllMocks()
    fichaCreateCounter = 0
    service = new PdfGeneratorService()
    mockPrisma.pedidoCompra.findUnique.mockResolvedValue(pedidoResolvido)
    mockPrisma.fichaProducao.create.mockImplementation(() => {
      fichaCreateCounter++
      return Promise.resolve({ id: `ficha-${fichaCreateCounter}`, setor: Setor.CABEDAL })
    })
    mockPrisma.fichaProducao.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.modelo.count.mockResolvedValue(0)
    mockRenderConsolidadoPdf.mockResolvedValue(Buffer.from('pdf-content'))
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.example.com/fichas-producao/pedidos/p1/cabedal.pdf' },
    })
  })

  // Teste 1
  it('deve gerar 3 fichas para um pedido com itens resolvidos', async () => {
    const { fichas } = await service.gerarFichas('p1')

    expect(fichas).toHaveLength(3)
    const setores = fichas.map((f) => f.setor)
    expect(setores).toContain(Setor.CABEDAL)
    expect(setores).toContain(Setor.PALMILHA)
    expect(setores).toContain(Setor.SOLA)
  })

  // Teste 2
  it('deve regenerar fichas se pedido já tiver fichas geradas (deleteMany + create)', async () => {
    mockPrisma.pedidoCompra.findUnique.mockResolvedValueOnce({
      ...pedidoResolvido,
      status: StatusPedido.FICHAS_GERADAS,
    })

    const result = await service.gerarFichas('p1')
    expect(result.fichas.length).toBeGreaterThan(0)
  })

  // Teste 3
  it('deve lançar erro se existirem itens pendentes', async () => {
    mockPrisma.pedidoCompra.findUnique.mockResolvedValueOnce({
      ...pedidoResolvido,
      itens: [{ id: 'i1', status: 'RESOLVIDO' }, { id: 'i2', status: 'PENDENTE' }],
    })

    await expect(service.gerarFichas('p1')).rejects.toThrow('Existem itens pendentes')
  })

  // Teste 4
  it('deve lançar erro se pedido não for encontrado', async () => {
    mockPrisma.pedidoCompra.findUnique.mockResolvedValueOnce(null)

    await expect(service.gerarFichas('p1')).rejects.toThrow('Pedido não encontrado')
  })

  // Teste 5
  it('deve fazer upload para o storage para cada ficha gerada', async () => {
    await service.gerarFichas('p1')

    // Upload chamado 3 vezes (1 por setor)
    expect(mockUpload).toHaveBeenCalledTimes(3)
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('pedidos/p1'),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/pdf' }),
    )
  })

  // Teste 6
  it('deve gerar fichas consolidadas para múltiplos pedidos', async () => {
    const p2 = { ...pedidoResolvido, id: 'p2', numero: 'PED-002' }
    mockPrisma.pedidoCompra.findMany = vi.fn().mockResolvedValue([pedidoResolvido, p2])

    const fichas = await service.gerarFichasConsolidadas(['p1', 'p2'])

    expect(fichas).toHaveLength(3)
    // Consolidado + ConsolidadoPedido are created inside $transaction
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  // Teste 7
  it('deve reportar aviso e continuar se upload ao storage falhar para um setor', async () => {
    // Falha apenas no primeiro upload (SOLA, que agora é processado primeiro)
    mockUpload
      .mockResolvedValueOnce({ error: { message: 'Storage offline' } })
      .mockResolvedValue({ error: null })

    const { fichas, avisos } = await service.gerarFichas('p1')
    // 2 fichas geradas (PALMILHA e CABEDAL), 1 falhou (SOLA)
    expect(fichas).toHaveLength(2)
    expect(avisos.some((a) => a.includes('SOLA'))).toBe(true)
  })

  // Teste 8
  it('deve chamar renderConsolidadoPdf para cada setor', async () => {
    await service.gerarFichas('p1')

    // Chamado 3 vezes (CABEDAL, PALMILHA, SOLA)
    expect(mockRenderConsolidadoPdf).toHaveBeenCalledTimes(3)
    const setoresChamados = mockRenderConsolidadoPdf.mock.calls.map((c) => c[0])
    expect(setoresChamados).toContain(Setor.CABEDAL)
    expect(setoresChamados).toContain(Setor.PALMILHA)
    expect(setoresChamados).toContain(Setor.SOLA)
  })

  // Teste 9 - Facheta condicional
  it('deve excluir FACHETA quando nenhum modelo tem facheta preenchido', async () => {
    mockPrisma.modelo.count.mockResolvedValue(0)

    const { fichas } = await service.gerarFichas('p1', [
      Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA, Setor.FACHETA,
    ])

    // Facheta é omitida porque nenhum modelo tem facheta preenchida
    const setores = fichas.map((f) => f.setor)
    expect(setores).not.toContain(Setor.FACHETA)
    expect(fichas).toHaveLength(3)
    expect(setores).toContain(Setor.CABEDAL)
    expect(setores).toContain(Setor.PALMILHA)
    expect(setores).toContain(Setor.SOLA)
  })

  // Teste 10
  it('deve retornar buffer e filename no download de ficha', async () => {
    mockPrisma.fichaProducao.findUnique.mockResolvedValueOnce({
      id: 'ficha-1',
      setor: Setor.CABEDAL,
      pdfUrl: 'https://storage.example.com/fichas-producao/pedidos/p1/cabedal.pdf',
    })

    const result = await service.downloadFicha('ficha-1')

    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.filename).toMatch(/^ficha-cabedal-/)
    expect(result.filename.endsWith('.pdf')).toBe(true)
  })
})
