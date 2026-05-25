import { createClient } from '@supabase/supabase-js'

export const useSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not configured')
  }

  return createClient(
    supabaseUrl,
    serviceKey
  )
}
