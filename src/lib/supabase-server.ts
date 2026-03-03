import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export function createServerSupabaseClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

export const FICHAS_BUCKET = 'fichas-producao'
