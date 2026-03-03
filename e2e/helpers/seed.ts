/**
 * seed.ts — Script de seed para testes E2E
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

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@thamyshoes.com.br' },
    update: { senha: senhaAdmin, ativo: true },
    create: {
      email: 'admin@thamyshoes.com.br',
      nome: 'Admin Teste',
      senha: senhaAdmin,
      perfil: Perfil.ADMIN,
      ativo: true,
    },
  })

  const pcp = await prisma.usuario.upsert({
    where: { email: 'pcp@thamyshoes.com.br' },
    update: { senha: senhaPcp, ativo: true },
    create: {
      email: 'pcp@thamyshoes.com.br',
      nome: 'PCP Teste',
      senha: senhaPcp,
      perfil: Perfil.PCP,
      ativo: true,
    },
  })

  const producao = await prisma.usuario.upsert({
    where: { email: 'producao@thamyshoes.com.br' },
    update: { senha: senhaProducao, ativo: true },
    create: {
      email: 'producao@thamyshoes.com.br',
      nome: 'Produção Teste',
      senha: senhaProducao,
      perfil: Perfil.PRODUCAO,
      setor: 'Cabedal',
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
      status: StatusConexao.CONECTADO,
    },
  })

  console.log(`  ✓ BlingConnection: ${blingConn.id} (${blingConn.status})`)

  // ── Regra SKU ─────────────────────────────────────────────────────────────

  const regraSku = await prisma.regraSku.upsert({
    where: { id: 'regra-e2e-test' },
    update: { ativo: true },
    create: {
      id: 'regra-e2e-test',
      nome: 'Regra Teste E2E',
      padrao: '^([A-Z]+)-(\\d+)-([A-Z]+)$',
      camposExtraidos: JSON.stringify({ modelo: 1, numeracao: 2, cor: 3 }),
      ativo: true,
    },
  })

  console.log(`  ✓ RegraSKU: ${regraSku.nome}`)

  // ── Mapeamentos de Cor ────────────────────────────────────────────────────

  const cores = [
    { codigo: 'PT', nome: 'Preto' },
    { codigo: 'BR', nome: 'Branco' },
    { codigo: 'VM', nome: 'Vermelho' },
    { codigo: 'AZ', nome: 'Azul' },
    { codigo: 'MR', nome: 'Marrom' },
  ]

  for (const cor of cores) {
    await prisma.mapeamentoCor.upsert({
      where: { codigo: cor.codigo },
      update: { nome: cor.nome },
      create: { codigo: cor.codigo, nome: cor.nome },
    })
  }

  console.log(`  ✓ Mapeamentos de cor: ${cores.map((c) => c.codigo).join(', ')}`)

  // ── Pedidos com itens resolvidos ──────────────────────────────────────────

  const pedido1 = await prisma.pedido.upsert({
    where: { numeroPedido: 'E2E-001' },
    update: { status: StatusPedido.RESOLVIDO },
    create: {
      numeroPedido: 'E2E-001',
      cliente: 'Cliente Teste E2E 1',
      status: StatusPedido.RESOLVIDO,
      blingId: 'bling-e2e-001',
      dataEmissao: new Date('2024-01-15'),
      itens: {
        create: [
          {
            sku: 'BOOT-38-PT',
            descricao: 'Bota Feminina 38 Preto',
            quantidade: 2,
            status: StatusItem.RESOLVIDO,
            modelo: 'Bota Feminina',
            cor: 'Preto',
            gradeTamanhos: JSON.stringify({ '38': 2 }),
            setor: 'Cabedal',
          },
          {
            sku: 'BOOT-39-PT',
            descricao: 'Bota Feminina 39 Preto',
            quantidade: 3,
            status: StatusItem.RESOLVIDO,
            modelo: 'Bota Feminina',
            cor: 'Preto',
            gradeTamanhos: JSON.stringify({ '39': 3 }),
            setor: 'Palmilha',
          },
        ],
      },
    },
  })

  const pedido2 = await prisma.pedido.upsert({
    where: { numeroPedido: 'E2E-002' },
    update: { status: StatusPedido.RESOLVIDO },
    create: {
      numeroPedido: 'E2E-002',
      cliente: 'Cliente Teste E2E 2',
      status: StatusPedido.RESOLVIDO,
      blingId: 'bling-e2e-002',
      dataEmissao: new Date('2024-01-20'),
      itens: {
        create: [
          {
            sku: 'SAND-36-BR',
            descricao: 'Sandália 36 Branco',
            quantidade: 4,
            status: StatusItem.RESOLVIDO,
            modelo: 'Sandália',
            cor: 'Branco',
            gradeTamanhos: JSON.stringify({ '36': 4 }),
            setor: 'Sola',
          },
        ],
      },
    },
  })

  console.log(`  ✓ Pedidos: ${pedido1.numeroPedido}, ${pedido2.numeroPedido}`)

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
