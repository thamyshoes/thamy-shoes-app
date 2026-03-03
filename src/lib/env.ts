import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  // Bling OAuth
  BLING_CLIENT_ID: z.string().min(1),
  BLING_CLIENT_SECRET: z.string().min(1),
  BLING_REDIRECT_URI: z.string().url(),
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY deve ter 64 chars hex (32 bytes)'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Notifications
  RESEND_API_KEY: z.string().min(1),
  NOTIFICATION_EMAIL_TO: z.string().email().optional(),

  // Seed
  ADMIN_EMAIL: z.string().email(),

  // Cron
  CRON_SECRET: z.string().min(16, 'CRON_SECRET deve ter no mínimo 16 caracteres'),
})

// SKIP_ENV_VALIDATION=1 allows local builds with placeholder .env.production values.
// On Vercel CI, real env vars from the dashboard are injected before build — validation is not needed.
export const env = process.env.SKIP_ENV_VALIDATION
  ? (process.env as unknown as z.infer<typeof envSchema>)
  : envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
