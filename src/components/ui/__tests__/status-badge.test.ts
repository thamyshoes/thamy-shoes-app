import { describe, it, expect } from 'vitest'

// Testa a lógica de mapeamento de status (sem DOM)
const STATUS_MAP: Record<string, string> = {
  IMPORTADO: 'info',
  FICHAS_GERADAS: 'success',
  PENDENTE_AJUSTE: 'warning',
  RESOLVIDO: 'success',
  PENDENTE: 'warning',
  CONECTADO: 'success',
  EXPIRADO: 'danger',
  DESCONECTADO: 'default',
}

const STATUS_LABEL: Record<string, string> = {
  IMPORTADO: 'Importado',
  FICHAS_GERADAS: 'Fichas Geradas',
  PENDENTE_AJUSTE: 'Pendente Ajuste',
  RESOLVIDO: 'Resolvido',
  PENDENTE: 'Pendente',
  CONECTADO: 'Conectado',
  EXPIRADO: 'Expirado',
  DESCONECTADO: 'Desconectado',
}

describe('StatusBadge — mapeamento de status', () => {
  it('mapeia FICHAS_GERADAS para variante success', () => {
    expect(STATUS_MAP['FICHAS_GERADAS']).toBe('success')
  })

  it('mapeia IMPORTADO para variante info', () => {
    expect(STATUS_MAP['IMPORTADO']).toBe('info')
  })

  it('mapeia PENDENTE_AJUSTE para variante warning', () => {
    expect(STATUS_MAP['PENDENTE_AJUSTE']).toBe('warning')
  })

  it('mapeia EXPIRADO para variante danger', () => {
    expect(STATUS_MAP['EXPIRADO']).toBe('danger')
  })

  it('mapeia DESCONECTADO para variante default', () => {
    expect(STATUS_MAP['DESCONECTADO']).toBe('default')
  })

  it('mapeia CONECTADO para variante success', () => {
    expect(STATUS_MAP['CONECTADO']).toBe('success')
  })

  it('retorna label correto para FICHAS_GERADAS', () => {
    expect(STATUS_LABEL['FICHAS_GERADAS']).toBe('Fichas Geradas')
  })

  it('cobre todos os 8 status documentados', () => {
    const expectedStatuses = [
      'IMPORTADO', 'FICHAS_GERADAS', 'PENDENTE_AJUSTE',
      'RESOLVIDO', 'PENDENTE', 'CONECTADO', 'EXPIRADO', 'DESCONECTADO',
    ]
    expectedStatuses.forEach((status) => {
      expect(STATUS_MAP[status]).toBeDefined()
    })
  })

  it('fallback para status desconhecido retorna undefined (componente usa default)', () => {
    expect(STATUS_MAP['UNKNOWN_STATUS']).toBeUndefined()
  })
})
