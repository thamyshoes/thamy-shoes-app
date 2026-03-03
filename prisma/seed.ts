import { PrismaClient, Perfil } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@thamyshoes.com.br'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'

  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      nome: 'Administrador',
      perfil: Perfil.ADMIN,
      ativo: true,
    },
  })

  console.log(`✅ Admin criado/verificado: ${admin.email} (perfil: ${admin.perfil})`)
  console.log('⚠️  IMPORTANTE: Altere a senha padrão em produção!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
