/**
 * seed.ts — Script de seed para testes E2E (base)
 *
 * Garante dados mínimos no banco de teste:
 *   - 3 usuários (ADMIN, PCP, PRODUCAO)
 *   - 1 BlingConnection mockada
 *   - 2 pedidos com itens resolvidos
 *   - 1 regra SKU ativa
 *   - 5 mapeamentos de cor
 *
 * Uso: npx ts-node --esm e2e/helpers/seed.ts
 *      ou via: npm run seed:test
 *
 * ATUALIZADO para schema V2 (model User, PedidoCompra, RegraSkU)
 */

import { PrismaClient, Perfil, StatusConexao, StatusPedido, StatusItem } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de testes E2E...')

  // ── Usuários ──────────────────────────────────────────────────────────────

  const senhaAdmin = await bcrypt.hash('admin123', 10)
  const senhaPcp = await bcrypt.hash('pcp123', 10)
  const senhaProducao = await bcrypt.hash('producao123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@thamyshoes.com.br' },
    update: { passwordHash: senhaAdmin, ativo: true },
    create: {
      email: 'admin@thamyshoes.com.br',
      nome: 'Admin Teste',
      passwordHash: senhaAdmin,
      perfil: Perfil.ADMIN,
      ativo: true,
    },
  })

  const pcp = await prisma.user.upsert({
    where: { email: 'pcp@thamyshoes.com.br' },
    update: { passwordHash: senhaPcp, ativo: true },
    create: {
      email: 'pcp@thamyshoes.com.br',
      nome: 'PCP Teste',
      passwordHash: senhaPcp,
      perfil: Perfil.PCP,
      ativo: true,
    },
  })

  const producao = await prisma.user.upsert({
    where: { email: 'producao@thamyshoes.com.br' },
    update: { passwordHash: senhaProducao, ativo: true },
    create: {
      email: 'producao@thamyshoes.com.br',
      nome: 'Produção Teste',
      passwordHash: senhaProducao,
      perfil: Perfil.PRODUCAO,
      setor: 'CABEDAL',
      ativo: true,
    },
  })

  console.log(`  ✓ Usuários: ${admin.email}, ${pcp.email}, ${producao.email}`)

  // ── BlingConnection mockada ───────────────────────────────────────────────

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias

  const blingConn = await prisma.blingConnection.upsert({
    where: { id: 'conn-e2e-test' },
    update: { status: StatusConexao.CONECTADO, expiresAt },
    create: {
      id: 'conn-e2e-test',
      accessToken: 'enc:e2e-mock-access-token',
      refreshToken: 'enc:e2e-mock-refresh-token',
      expiresAt,
      connectedAt: new Date(),
      status: StatusConexao.CONECTADO,
    },
  })

  console.log(`  ✓ BlingConnection: ${blingConn.id} (${blingConn.status})`)

  // ── Regra SKU ─────────────────────────────────────────────────────────────

  const regraSku = await prisma.regraSkU.upsert({
    where: { id: 'regra-e2e-test' },
    update: { ativa: true },
    create: {
      id: 'regra-e2e-test',
      nome: 'Regra Teste E2E',
      modo: 'SEPARADOR',
      separador: '-',
      ordem: JSON.parse('["modelo","cor","tamanho"]'),
      segmentos: JSON.parse('{"modelo":{"posicao":0},"cor":{"posicao":1},"tamanho":{"posicao":2}}'),
      ativa: true,
    },
  })

  console.log(`  ✓ RegraSkU: ${regraSku.nome}`)

  // ── Mapeamentos de Cor ────────────────────────────────────────────────────

  const cores = [
    { codigo: 'PT', descricao: 'Preto' },
    { codigo: 'BR', descricao: 'Branco' },
    { codigo: 'VM', descricao: 'Vermelho' },
    { codigo: 'AZ', descricao: 'Azul' },
    { codigo: 'MR', descricao: 'Marrom' },
  ]

  for (const cor of cores) {
    await prisma.mapeamentoCor.upsert({
      where: { codigo: cor.codigo },
      update: { descricao: cor.descricao },
      create: { codigo: cor.codigo, descricao: cor.descricao },
    })
  }

  console.log(`  ✓ Mapeamentos de cor: ${cores.map((c) => c.codigo).join(', ')}`)

  // ── Pedidos com itens ─────────────────────────────────────────────────────

  const pedido1 = await prisma.pedidoCompra.upsert({
    where: { idBling: BigInt('8880001') },
    update: { status: StatusPedido.IMPORTADO },
    create: {
      idBling: BigInt('8880001'),
      numero: 'E2E-001',
      dataEmissao: new Date('2024-01-15'),
      fornecedorNome: 'Cliente Teste E2E 1',
      status: StatusPedido.IMPORTADO,
      itens: {
        create: [
          {
            descricaoBruta: 'Bota Feminina 38 Preto',
            skuBruto: 'BOOT-38-PT',
            quantidade: 2,
            modelo: 'Bota Feminina',
            cor: 'PT',
            tamanho: 38,
            status: StatusItem.PENDENTE,
          },
          {
            descricaoBruta: 'Bota Feminina 39 Preto',
            skuBruto: 'BOOT-39-PT',
            quantidade: 3,
            modelo: 'Bota Feminina',
            cor: 'PT',
            tamanho: 39,
            status: StatusItem.PENDENTE,
          },
        ],
      },
    },
  })

  const pedido2 = await prisma.pedidoCompra.upsert({
    where: { idBling: BigInt('8880002') },
    update: { status: StatusPedido.IMPORTADO },
    create: {
      idBling: BigInt('8880002'),
      numero: 'E2E-002',
      dataEmissao: new Date('2024-01-20'),
      fornecedorNome: 'Cliente Teste E2E 2',
      status: StatusPedido.IMPORTADO,
      itens: {
        create: [
          {
            descricaoBruta: 'Sandália 36 Branco',
            skuBruto: 'SAND-36-BR',
            quantidade: 4,
            modelo: 'Sandália',
            cor: 'BR',
            tamanho: 36,
            status: StatusItem.PENDENTE,
          },
        ],
      },
    },
  })

  console.log(`  ✓ Pedidos: ${pedido1.numero}, ${pedido2.numero}`)

  console.log('\n✅ Seed de testes E2E concluído!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed E2E:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
