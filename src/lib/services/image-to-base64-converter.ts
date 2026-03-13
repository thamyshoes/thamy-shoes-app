/**
 * Converte URL pública de imagem em data URI base64 para uso no @react-pdf/renderer.
 * Executa apenas no servidor (API Route) — nunca no cliente.
 */
export async function imageUrlToBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const base64 = Buffer.from(buffer).toString('base64')

    return `data:${contentType};base64,${base64}`
  } catch {
    console.warn('[ImageToBase64] Falha ao converter imagem:', url)
    return null
  }
}
