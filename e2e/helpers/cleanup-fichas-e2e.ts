/**
 * cleanup-fichas-e2e.ts — Limpa dados criados pelo seed-fichas-e2e.ts
 *
 * Usado em test.afterAll dos specs fichas-v2-*.spec.ts para evitar
 * dados residuais que causem falha em re-execuções.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function cleanupFichasE2E() {
  try {
    // Deletar fichas geradas durante os testes
    await prisma.fichaProducao.deleteMany({
      where: {
        pedido: {
          numero: { startsWith: 'E2EV2-' },
        },
      },
    })

    // Deletar itens dos pedidos de teste
    await prisma.itemPedido.deleteMany({
      where: {
        pedido: {
          numero: { startsWith: 'E2EV2-' },
        },
      },
    })

    // Deletar pedidos de teste
    await prisma.pedido.deleteMany({
      where: { numero: { startsWith: 'E2EV2-' } },
    })

    // Deletar variantes do modelo de teste
    await prisma.modeloVarianteCor.deleteMany({
      where: {
        modelo: { codigo: 'ABC123' },
      },
    })

    // Deletar modelo de teste
    await prisma.modelo.deleteMany({
      where: { codigo: 'ABC123' },
    })

    // Deletar cor de teste
    await prisma.mapeamentoCor.deleteMany({
      where: { codigo: '001', descricao: 'Vermelho' },
    })

    console.log('🧹 Cleanup fichas-e2e concluído')
  } catch (err) {
    console.error('⚠️ Cleanup fichas-e2e falhou (dados podem já ter sido removidos):', err)
  } finally {
    await prisma.$disconnect()
  }
}
