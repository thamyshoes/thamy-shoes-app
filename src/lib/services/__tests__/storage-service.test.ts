import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StorageService, StorageServiceError, VARIANTES_BUCKET } from '../storage-service'

const mockCreateSignedUploadUrl = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: () => ({
    storage: {
      from: (_bucket: string) => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}))

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateSignedUrl', () => {
    it('retorna signedUrl e path quando Supabase responde com sucesso', async () => {
      const fakeSignedUrl =
        'https://supabase.co/storage/v1/object/sign/variantes-imagens/variantes/123-foto.jpg?token=xyz'
      mockCreateSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: fakeSignedUrl },
        error: null,
      })

      const result = await StorageService.generateSignedUrl('foto.jpg', 'image/jpeg')

      expect(result.signedUrl).toBe(fakeSignedUrl)
      expect(result.path).toMatch(/^variantes\/\d+-foto\.jpg$/)
      expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^variantes\/\d+-foto\.jpg$/),
      )
    })

    it('lança StorageServiceError quando Supabase retorna erro', async () => {
      mockCreateSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'bucket não encontrado' },
      })

      await expect(
        StorageService.generateSignedUrl('foto.jpg', 'image/jpeg'),
      ).rejects.toBeInstanceOf(StorageServiceError)

      mockCreateSignedUploadUrl.mockResolvedValue({
        data: null,
        error: { message: 'bucket não encontrado' },
      })

      await expect(
        StorageService.generateSignedUrl('foto.jpg', 'image/jpeg'),
      ).rejects.toThrow('bucket não encontrado')
    })

    it('path gerado usa timestamp e nome do arquivo original', async () => {
      const beforeTs = Date.now()
      mockCreateSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed' },
        error: null,
      })

      const result = await StorageService.generateSignedUrl('imagem-teste.png', 'image/png')

      const afterTs = Date.now()
      const match = result.path.match(/^variantes\/(\d+)-imagem-teste\.png$/)
      expect(match).not.toBeNull()
      const ts = parseInt(match![1], 10)
      expect(ts).toBeGreaterThanOrEqual(beforeTs)
      expect(ts).toBeLessThanOrEqual(afterTs)
    })
  })

  describe('getPublicUrl', () => {
    it('retorna URL pública correta para o path fornecido', () => {
      const fakePublicUrl = `https://supabase.co/storage/v1/object/public/${VARIANTES_BUCKET}/variantes/123-foto.jpg`
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: fakePublicUrl },
      })

      const url = StorageService.getPublicUrl('variantes/123-foto.jpg')

      expect(url).toBe(fakePublicUrl)
      expect(mockGetPublicUrl).toHaveBeenCalledWith('variantes/123-foto.jpg')
    })
  })
})
