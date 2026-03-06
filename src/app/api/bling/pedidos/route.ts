import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { blingService, BlingApiError } from '@/lib/bling/bling-service'
import { CircuitOpenError } from '@/lib/bling/circuit-breaker'
import { StatusConexao } from '@/types'

// GET /api/bling/pedidos?dias=7&pagina=1
// Admin only — protected by middleware
export async function GET(req: NextRequest) {
  const diasParam = req.nextUrl.searchParams.get('dias')
  const paginaParam = req.nextUrl.searchParams.get('pagina')
  const dias = diasParam ? Math.min(Math.max(parseInt(diasParam, 10) || 7, 1), 90) : 7
  const pagina = paginaParam ? Math.max(parseInt(paginaParam, 10) || 1, 1) : 1

  // Verificar conexão Bling
  const connection = await prisma.blingConnection.findFirst()
  if (!connection || connection.status !== StatusConexao.CONECTADO) {
    return NextResponse.json(
      { error: 'Conecte ao Bling primeiro' },
      { status: 400 },
    )
  }

  try {
    const { data: pedidosBling, hasMore } = await blingService.listPedidosCompra(dias, pagina)

    // Buscar IDs que já foram importados
    const idsBling = pedidosBling.map((p) => BigInt(p.id))
    const importados = await prisma.pedidoCompra.findMany({
      where: { idBling: { in: idsBling } },
      select: { idBling: true, createdAt: true },
    })
    const importadoMap = new Map(
      importados.map((p) => [p.idBling.toString(), p.createdAt.toISOString()]),
    )

    const data = pedidosBling.map((p) => {
      const importadoEm = importadoMap.get(p.id.toString())
      return {
        idBling: p.id,
        numero: p.numero,
        dataEmissao: p.dataCompra,
        observacoesInternas: p.observacoesInternas ?? p.observacoes ?? '—',
        situacao: p.situacao?.valor ?? '—',
        importado: !!importadoEm,
        importadoEm: importadoEm ?? null,
      }
    })

    return NextResponse.json({ data, pagina, hasMore })
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return NextResponse.json(
        { error: 'Bling temporariamente indisponível' },
        { status: 503 },
      )
    }
    if (err instanceof BlingApiError && err.status === 401) {
      return NextResponse.json(
        { error: 'Token expirado. Reconecte.' },
        { status: 401 },
      )
    }
    if (err instanceof Error && err.message.includes('expirado')) {
      return NextResponse.json(
        { error: 'Token expirado. Reconecte.' },
        { status: 401 },
      )
    }
    console.error('[GET /api/bling/pedidos]', err)
    return NextResponse.json({ error: 'Ocorreu um erro. Tente novamente.' }, { status: 500 })
  }
}
