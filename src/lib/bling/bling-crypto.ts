import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { env } from '@/lib/env'

const ALGORITHM = 'aes-256-gcm'

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in the format: {iv_hex}:{authTag_hex}:{ciphertext_hex}
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a string produced by encrypt().
 * Throws if the format is invalid or authentication fails.
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Formato de dados criptografados inválido')
  }
  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string]
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
