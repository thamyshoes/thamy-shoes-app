import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { blingService, BlingApiError } from '@/lib/bling/bling-service'
import { CircuitOpenError } from '@/lib/bling/circuit-breaker'
import { StatusConexao } from '@/types'

// GET /api/bling/produtos?pagina=1
// Admin only — protected by middleware
export async function GET(req: NextRequest) {
  const paginaParam = req.nextUrl.searchParams.get('pagina')
  const pagina = paginaParam ? Math.max(parseInt(paginaParam, 10) || 1, 1) : 1

  const connection = await prisma.blingConnection.findFirst()
  if (!connection || connection.status !== StatusConexao.CONECTADO) {
    return NextResponse.json({ error: 'Conecte ao Bling primeiro' }, { status: 400 })
  }

  try {
    const { data: produtosBling, hasMore } = await blingService.listProdutos(pagina)

    // Buscar quais já foram importados
    const idsBling = produtosBling.map((p) => BigInt(p.id))
    const importados = await prisma.produto.findMany({
      where: { idBling: { in: idsBling } },
      select: { idBling: true, createdAt: true },
    })
    const importadoMap = new Map(
      importados.map((p) => [p.idBling.toString(), p.createdAt.toISOString()]),
    )

    const data = produtosBling.map((p) => ({
      id: p.id.toString(),
      idBling: p.id,
      nome: p.nome,
      codigo: p.codigo,
      imagemUrl: p.imagemThumbnail ?? null,
      importado: importadoMap.has(p.id.toString()),
      importadoEm: importadoMap.get(p.id.toString()) ?? null,
    }))

    return NextResponse.json({ data, pagina, hasMore })
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return NextResponse.json({ error: 'Bling temporariamente indisponível' }, { status: 503 })
    }
    if (err instanceof BlingApiError && err.status === 401) {
      return NextResponse.json({ error: 'Token expirado. Reconecte.' }, { status: 401 })
    }
    if (err instanceof Error && err.message.includes('expirado')) {
      return NextResponse.json({ error: 'Token expirado. Reconecte.' }, { status: 401 })
    }
    console.error('[GET /api/bling/produtos]', err)
    return NextResponse.json({ error: 'Ocorreu um erro. Tente novamente.' }, { status: 500 })
  }
}
