import { createServerSupabaseClient } from '@/lib/supabase-server'

export const VARIANTES_BUCKET = 'variantes-imagens'

export class StorageServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageServiceError'
  }
}

export const StorageService = {
  /**
   * Gera uma signed URL para upload direto pelo browser.
   * O upload real (PUT para a signed URL) é feito pelo cliente — esta função apenas gera a URL.
   * Expiração: controlada pelo Supabase dashboard (default ~2h para upload URLs).
   * Nota: createSignedUploadUrl do Supabase SDK não aceita parâmetro de expiração
   * (diferente de createSignedUrl para download que aceita expiresIn).
   */
  async generateSignedUrl(
    fileName: string,
    _contentType: string,
  ): Promise<{ signedUrl: string; path: string }> {
    const supabase = createServerSupabaseClient()
    const path = `variantes/${Date.now()}-${fileName}`

    const { data, error } = await supabase.storage
      .from(VARIANTES_BUCKET)
      .createSignedUploadUrl(path)

    if (error) {
      throw new StorageServiceError(
        `Falha ao gerar signed URL para "${fileName}": ${error.message}`,
      )
    }

    // Supabase types incluem signedUrl na resposta de createSignedUploadUrl
    const signedUrl = (data as { signedUrl: string }).signedUrl

    return { signedUrl, path }
  },

  /**
   * Retorna a URL pública de um arquivo no bucket.
   * O bucket deve ter leitura pública habilitada via RLS policy.
   */
  getPublicUrl(path: string): string {
    const supabase = createServerSupabaseClient()
    const { data } = supabase.storage.from(VARIANTES_BUCKET).getPublicUrl(path)
    return data.publicUrl
  },
}
