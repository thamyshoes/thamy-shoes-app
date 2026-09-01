import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function ExportacaoPage() {
  const requestHeaders = await headers()
  if (requestHeaders.get('x-user-perfil') !== 'ADMIN') {
    redirect('/pedidos')
  }

  const [
    modelos,
    cores,
    grades,
    gradesModelo,
    regrasSku,
    equivalencias,
    materiais,
    referencias,
    camposExtras,
    produtosRaw,
  ] = await Promise.all([
    prisma.modelo.findMany({ include: { variantesCor: true }, orderBy: { codigo: 'asc' } }),
    prisma.mapeamentoCor.findMany({ orderBy: { codigo: 'asc' } }),
    prisma.gradeNumeracao.findMany({ orderBy: { nome: 'asc' } }),
    prisma.gradeModelo.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.regraSkU.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.regraEquivalencia.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.material.findMany({ orderBy: [{ categoria: 'asc' }, { nome: 'asc' }] }),
    prisma.referencia.findMany({ orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }] }),
    prisma.campoExtra.findMany({ orderBy: [{ setor: 'asc' }, { ordem: 'asc' }] }),
    prisma.produto.findMany({ orderBy: { codigo: 'asc' } }),
  ])

  const produtos = produtosRaw.map(({ idBling, ...produto }) => ({
    ...produto,
    idBling: idBling.toString(),
  }))

  const exportacao = {
    versao: 1,
    origem: 'thamy-shoes-app',
    exportadoEm: new Date().toISOString(),
    modelos,
    cores,
    grades,
    gradesModelo,
    regrasSku,
    equivalencias,
    materiais,
    referencias,
    camposExtras,
    produtos,
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Exportação administrativa</h1>
      <p>Dados de produção preparados para migração.</p>
      <pre data-testid="exportacao-json" style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(exportacao)}
      </pre>
    </main>
  )
}
