import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerSupabaseClient, FICHAS_BUCKET } from '@/lib/supabase-server'

const TTL_DAYS = 20

async function handleCleanup(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000)

    const fichasExpiradas = await prisma.fichaProducao.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, pdfUrl: true },
    })

    if (fichasExpiradas.length === 0) {
      return NextResponse.json({
        success: true,
        deletadas: 0,
        message: 'Nenhuma ficha expirada',
      })
    }

    // Mapear ficha ID → storage path
    const fichaPathMap = new Map<string, string>()
    for (const ficha of fichasExpiradas) {
      const marker = `${FICHAS_BUCKET}/`
      const idx = ficha.pdfUrl.indexOf(marker)
      if (idx !== -1) {
        fichaPathMap.set(ficha.id, ficha.pdfUrl.slice(idx + marker.length))
      }
    }

    // Deletar PDFs do Supabase Storage (em lotes de 20)
    // Rastrear quais IDs tiveram storage deletado com sucesso
    const idsComStorageDeletado = new Set<string>()
    let arquivosDeletados = 0

    if (fichaPathMap.size > 0) {
      const supabase = createServerSupabaseClient()
      const entries = Array.from(fichaPathMap.entries())
      const BATCH = 20

      for (let i = 0; i < entries.length; i += BATCH) {
        const batchEntries = entries.slice(i, i + BATCH)
        const batchPaths = batchEntries.map(([, path]) => path)
        const { error } = await supabase.storage
          .from(FICHAS_BUCKET)
          .remove(batchPaths)
        if (!error) {
          arquivosDeletados += batchPaths.length
          for (const [id] of batchEntries) {
            idsComStorageDeletado.add(id)
          }
        } else {
          console.warn('[cleanup-fichas] Erro ao deletar batch do storage:', error.message)
        }
      }
    }

    // IDs sem storage (URL não continha o marker) podem ser deletados direto
    const idsSemStorage = fichasExpiradas
      .filter((f) => !fichaPathMap.has(f.id))
      .map((f) => f.id)

    // Deletar apenas registros cujo storage foi removido (ou que não tinham storage)
    const idsParaDeletar = [...idsComStorageDeletado, ...idsSemStorage]
    let count = 0
    if (idsParaDeletar.length > 0) {
      const result = await prisma.fichaProducao.deleteMany({
        where: { id: { in: idsParaDeletar } },
      })
      count = result.count
    }

    const fichasRetidas = fichasExpiradas.length - idsParaDeletar.length

    return NextResponse.json({
      success: true,
      deletadas: count,
      arquivosDeletados,
      retidas: fichasRetidas,
      cutoff: cutoff.toISOString(),
    })
  } catch (err) {
    console.error('[cron/cleanup-fichas] Erro:', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handleCleanup(request)
}

export async function POST(request: NextRequest) {
  return handleCleanup(request)
}
