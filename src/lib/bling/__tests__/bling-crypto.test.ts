import { describe, it, expect, vi } from 'vitest'

// Mock env before importing the crypto module
vi.mock('@/lib/env', () => ({
  env: {
    ENCRYPTION_KEY: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  },
}))

const { encrypt, decrypt } = await import('@/lib/bling/bling-crypto')

describe('bling-crypto', () => {
  describe('encrypt', () => {
    it('retorna string no formato iv:authTag:ciphertext', () => {
      const result = encrypt('test-token')
      const parts = result.split(':')
      expect(parts).toHaveLength(3)
      expect(parts[0]).toHaveLength(32) // 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32) // 16 bytes auth tag = 32 hex chars
      expect(parts[2]!.length).toBeGreaterThan(0)
    })

    it('produz valores diferentes para a mesma entrada (IV aleatório)', () => {
      const first = encrypt('mesmo-token')
      const second = encrypt('mesmo-token')
      expect(first).not.toBe(second)
    })

    it('criptografa string vazia sem erro', () => {
      const result = encrypt('')
      expect(result.split(':')).toHaveLength(3)
    })

    it('criptografa string longa', () => {
      const longToken = 'x'.repeat(1000)
      const result = encrypt(longToken)
      expect(result.split(':')).toHaveLength(3)
    })
  })

  describe('decrypt', () => {
    it('recupera o texto original após encrypt/decrypt', () => {
      const original = 'access-token-bling-12345'
      const encrypted = encrypt(original)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(original)
    })

    it('recupera tokens OAuth com caracteres especiais', () => {
      const token = 'Bearer abc.def+ghi/jkl=mno'
      expect(decrypt(encrypt(token))).toBe(token)
    })

    it('lança erro para formato inválido', () => {
      expect(() => decrypt('invalido')).toThrow()
      expect(() => decrypt('a:b')).toThrow()
      expect(() => decrypt('')).toThrow()
    })

    it('lança erro para dados corrompidos (auth tag inválida)', () => {
      const encrypted = encrypt('token-original')
      const parts = encrypted.split(':')
      // Corrompe o auth tag
      const corrupted = `${parts[0]}:0000000000000000000000000000000f:${parts[2]}`
      expect(() => decrypt(corrupted)).toThrow()
    })
  })

  describe('roundtrip', () => {
    it('access_token e refresh_token sobrevivem ao roundtrip', () => {
      const accessToken = 'ey' + 'J'.repeat(200) + '.payload.signature'
      const refreshToken = 'rt_' + 'r'.repeat(100)
      expect(decrypt(encrypt(accessToken))).toBe(accessToken)
      expect(decrypt(encrypt(refreshToken))).toBe(refreshToken)
    })
  })
})
