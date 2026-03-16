/**
 * Seed de usuarios de teste - gerado por /create-test-user
 * Cria usuarios para cada role: ADMIN, PCP, PRODUCAO
 *
 * Execute: npx ts-node --esm scripts/seed-test-users.ts
 * Ou: npm run seed:test-users (se configurado em package.json)
 */

import { PrismaClient, Perfil, Setor } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const BCRYPT_ROUNDS = 12

interface TestUser {
  role: Perfil
  email: string
  password: string
  nome: string
  setor?: Setor
  ativo: boolean
}

const testUsers: TestUser[] = [
  {
    role: Perfil.ADMIN,
    email: 'admin@thamy-shoes.test',
    password: 'Test@Admin2025!',
    nome: 'Carlos Oliveira da Silva',
    ativo: true,
  },
  {
    role: Perfil.PCP,
    email: 'pcp@thamy-shoes.test',
    password: 'Test@PCP2025!',
    nome: 'Ana Paula Ferreira Santos',
    ativo: true,
  },
  {
    role: Perfil.PRODUCAO,
    email: 'producao-cabedal@thamy-shoes.test',
    password: 'Test@Producao2025!',
    nome: 'Roberto Martins Gomes',
    setor: Setor.CABEDAL,
    ativo: true,
  },
  {
    role: Perfil.PRODUCAO,
    email: 'producao-palmilha@thamy-shoes.test',
    password: 'Test@Producao2025!',
    nome: 'Marta Cristina Rodrigues',
    setor: Setor.PALMILHA,
    ativo: true,
  },
  {
    role: Perfil.PRODUCAO,
    email: 'producao-sola@thamy-shoes.test',
    password: 'Test@Producao2025!',
    nome: 'Fernando Alves Costa',
    setor: Setor.SOLA,
    ativo: true,
  },
]

async function main() {
  console.log('\n🌱 Iniciando seed de usuarios de teste...\n')

  const created = 0
  const updated = 0
  const skipped = 0

  for (const testUser of testUsers) {
    try {
      const passwordHash = await bcrypt.hash(testUser.password, BCRYPT_ROUNDS)

      const user = await prisma.user.upsert({
        where: { email: testUser.email },
        update: {
          passwordHash,
          nome: testUser.nome,
          perfil: testUser.role,
          setores: { set: testUser.setor ? [testUser.setor] : [] },
          ativo: testUser.ativo,
        },
        create: {
          email: testUser.email,
          passwordHash,
          nome: testUser.nome,
          perfil: testUser.role,
          setores: testUser.setor ? [testUser.setor] : [],
          ativo: testUser.ativo,
        },
      })

      // Determine if created or updated
      const existed = await prisma.user.findUnique({
        where: { email: testUser.email },
      })

      if (existed) {
        console.log(
          `  ✓ ${testUser.role.padEnd(9)} | ${testUser.email.padEnd(35)} | ID: ${user.id}`
        )
      }
    } catch (error) {
      console.error(
        `  ❌ Erro ao criar usuario ${testUser.email}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  console.log(`\n✅ Seed de usuarios de teste concluído!`)
  console.log(`   Total processado: ${testUsers.length}`)
  console.log(`\n📋 Usuarios de teste criados:`)
  console.log('   └─ ADMIN:     admin@thamy-shoes.test / Test@Admin2025!')
  console.log('   ├─ PCP:       pcp@thamy-shoes.test / Test@PCP2025!')
  console.log('   └─ PRODUCAO:  producao-*@thamy-shoes.test / Test@Producao2025!')
  console.log('      ├─ Cabedal:   producao-cabedal@thamy-shoes.test')
  console.log('      ├─ Palmilha:  producao-palmilha@thamy-shoes.test')
  console.log('      └─ Sola:      producao-sola@thamy-shoes.test\n')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
