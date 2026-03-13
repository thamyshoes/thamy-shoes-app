/**
 * seed-fichas-e2e.ts — Seed específico para testes E2E de fichas-producao-v2
 *
 * Cria dados mínimos necessários para validar os 3 fluxos principais:
 *   - Admin cadastra variante de modelo com imagem
 *   - PCP gera fichas V2 via dialog de setores
 *   - PCP consolida pedidos
 *
 * Uso: npx ts-node --esm prisma/seed-fichas-e2e.ts
 */

import { PrismaClient, Perfil, Setor, StatusPedido, StatusItem } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seed fichas-e2e iniciando...')

  // ── Usuários ────────────────────────────────────────────────────────────────

  const [hashAdmin, hashPcp, hashProducao] = await Promise.all([
    bcrypt.hash('admin123', 10),
    bcrypt.hash('pcp123', 10),
    bcrypt.hash('producao123', 10),
  ])

  const admin = await prisma.user.upsert({
    where: { email: 'admin@thamyshoes.com.br' },
    update: { passwordHash: hashAdmin, ativo: true },
    create: {
      email: 'admin@thamyshoes.com.br',
      passwordHash: hashAdmin,
      nome: 'Admin E2E',
      perfil: Perfil.ADMIN,
      ativo: true,
    },
  })

  const pcp = await prisma.user.upsert({
    where: { email: 'pcp@thamyshoes.com.br' },
    update: { passwordHash: hashPcp, ativo: true },
    create: {
      email: 'pcp@thamyshoes.com.br',
      passwordHash: hashPcp,
      nome: 'PCP E2E',
      perfil: Perfil.PCP,
      ativo: true,
    },
  })

  const producao = await prisma.user.upsert({
    where: { email: 'producao@thamyshoes.com.br' },
    update: { passwordHash: hashProducao, ativo: true, setor: Setor.CABEDAL },
    create: {
      email: 'producao@thamyshoes.com.br',
      passwordHash: hashProducao,
      nome: 'Producao E2E',
      perfil: Perfil.PRODUCAO,
      setor: Setor.CABEDAL,
      ativo: true,
    },
  })

  console.log(`  ✓ Usuários: ${admin.email}, ${pcp.email}, ${producao.email}`)

  // ── Mapeamento de Cor ───────────────────────────────────────────────────────

  const cor = await prisma.mapeamentoCor.upsert({
    where: { codigo: '001' },
    update: { descricao: 'Vermelho', hex: '#FF0000' },
    create: {
      codigo: '001',
      descricao: 'Vermelho',
      hex: '#FF0000',
    },
  })

  console.log(`  ✓ Cor: ${cor.codigo} (${cor.descricao}) hex=${cor.hex}`)

  // ── Modelo ──────────────────────────────────────────────────────────────────

  const modelo = await prisma.modelo.upsert({
    where: { codigo: 'ABC123' },
    update: { nome: 'Bota Social E2E', ativo: true },
    create: {
      codigo: 'ABC123',
      nome: 'Bota Social E2E',
      ativo: true,
    },
  })

  console.log(`  ✓ Modelo: ${modelo.codigo} — ${modelo.nome}`)

  // ── Variante de Cor ─────────────────────────────────────────────────────────

  const variante = await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo.id, corCodigo: cor.codigo } },
    update: {},
    create: {
      modeloId: modelo.id,
      corCodigo: cor.codigo,
      imagemUrl: null,
    },
  })

  console.log(`  ✓ Variante: modeloId=${variante.modeloId} corCodigo=${variante.corCodigo}`)

  // ── Pedido E2E-V2-001 (2 itens SKU ABC123-001-37 + ABC123-001-38) ──────────

  const pedido1 = await prisma.pedidoCompra.upsert({
    where: { idBling: BigInt('9990001') },
    update: { status: StatusPedido.IMPORTADO },
    create: {
      idBling: BigInt('9990001'),
      numero: 'E2EV2-001',
      dataEmissao: new Date('2026-01-10'),
      fornecedorNome: 'Fornecedor E2E',
      status: StatusPedido.IMPORTADO,
      itens: {
        create: [
          {
            descricaoBruta: 'Bota Social E2E ABC123-001 37',
            skuBruto: 'ABC123-001-37',
            quantidade: 2,
            modelo: 'ABC123',
            cor: '001',
            tamanho: 37,
            status: StatusItem.PENDENTE,
          },
          {
            descricaoBruta: 'Bota Social E2E ABC123-001 38',
            skuBruto: 'ABC123-001-38',
            quantidade: 3,
            modelo: 'ABC123',
            cor: '001',
            tamanho: 38,
            status: StatusItem.PENDENTE,
          },
        ],
      },
    },
  })

  console.log(`  ✓ Pedido: ${pedido1.numero} (${pedido1.status})`)

  // ── Pedido E2E-V2-002 (para consolidado) ───────────────────────────────────

  const pedido2 = await prisma.pedidoCompra.upsert({
    where: { idBling: BigInt('9990002') },
    update: { status: StatusPedido.IMPORTADO },
    create: {
      idBling: BigInt('9990002'),
      numero: 'E2EV2-002',
      dataEmissao: new Date('2026-01-11'),
      fornecedorNome: 'Fornecedor E2E',
      status: StatusPedido.IMPORTADO,
      itens: {
        create: [
          {
            descricaoBruta: 'Bota Social E2E ABC123-001 39',
            skuBruto: 'ABC123-001-39',
            quantidade: 1,
            modelo: 'ABC123',
            cor: '001',
            tamanho: 39,
            status: StatusItem.PENDENTE,
          },
        ],
      },
    },
  })

  console.log(`  ✓ Pedido: ${pedido2.numero} (${pedido2.status})`)

  console.log('\n✅ Seed fichas-e2e concluído!')
  console.log('   Pedidos: E2EV2-001, E2EV2-002')
  console.log('   Modelo: ABC123 com variante 001 (Vermelho #FF0000)')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed fichas-e2e:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
