import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-guard'
import { StorageService, StorageServiceError } from '@/lib/services/storage-service'
import { SignedUrlRequestSchema } from '@/lib/schemas/fichas-v2'

// POST /api/variantes/signed-url
// Gera signed URL para upload direto de imagem de variante pelo browser.
// Apenas ADMIN pode gerar signed URLs (uploads são autenticados).
export async function POST(request: NextRequest) {
  const guard = requireAdmin(request)
  if (guard) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = SignedUrlRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await StorageService.generateSignedUrl(
      parsed.data.fileName,
      parsed.data.contentType,
    )
    const publicUrl = StorageService.getPublicUrl(result.path)
    return NextResponse.json({ ...result, publicUrl })
  } catch (e) {
    if (e instanceof StorageServiceError) {
      return NextResponse.json({ error: 'Erro ao gerar URL de upload' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
