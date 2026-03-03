import { randomBytes, createHash } from 'crypto'

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  return { token, tokenHash }
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
