import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// This gateway intentionally does not ship with generated Supabase types.
// Use `any` at the client boundary so the rest of the gateway stays schema-agnostic.
// (Without generated Database types, supabase-js will infer `never` for table names.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: ReturnType<typeof createClient<any>> | null = null

export function useSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured')
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not configured')

  if (!cached) {
    // supabase-js v2 instantiates a RealtimeClient on construction. On Node < 22
    // (no native WebSocket) this throws unless `ws` is provided. The gateway
    // never uses realtime — this just unblocks construction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cached = createClient<any>(supabaseUrl, serviceKey, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime: { transport: ws as any }
    })
  }
  return cached
}
