/**
 * Garante que a regra SKU ativa é o modo SUFIXO padrão do Bling.
 * Desativa qualquer regra ativa, cria a SUFIXO se não existir e a ativa.
 *
 * Execute: npx ts-node scripts/fix-regra-sku-sufixo.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando regras SKU...')

  const regras = await prisma.regraSkU.findMany()
  console.log(`   ${regras.length} regra(s) encontrada(s)`)
  regras.forEach((r) => console.log(`   - "${r.nome}" | modo=${r.modo} | ativa=${r.ativa}`))

  // Desativar todas as regras ativas
  await prisma.regraSkU.updateMany({ where: { ativa: true }, data: { ativa: false } })
  console.log('   ✓ Regras ativas desativadas')

  // Verificar se já existe uma regra SUFIXO
  let regraSufixo = await prisma.regraSkU.findFirst({ where: { modo: 'SUFIXO' } })

  if (regraSufixo) {
    await prisma.regraSkU.update({ where: { id: regraSufixo.id }, data: { ativa: true } })
    console.log(`   ✓ Regra SUFIXO existente ativada: "${regraSufixo.nome}"`)
  } else {
    regraSufixo = await prisma.regraSkU.create({
      data: {
        nome: 'Sufixo Padrão (Bling)',
        modo: 'SUFIXO',
        separador: '',
        ordem: ['modelo', 'cor', 'tamanho'],
        segmentos: {},
        digitosSufixo: [
          { campo: 'tamanho', digitos: 2 },
          { campo: 'cor', digitos: 3 },
        ],
        ativa: true,
      },
    })
    console.log(`   ✓ Regra SUFIXO criada e ativada: "${regraSufixo.nome}"`)
  }

  console.log('\n✅ Regra ativa agora: SUFIXO | tamanho=2 dígitos | cor=3 dígitos')
  console.log('   Exemplo: 61044433 → modelo=610, cor=044, tamanho=33')
  console.log('\n⚠️  Reimporte os pedidos para reparsar os itens com a nova regra.')
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
