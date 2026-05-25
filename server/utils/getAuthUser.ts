import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

/**
 * Get the authenticated user from the request.
 * Tries serverSupabaseUser first (uses getClaims), falls back to getUser().
 */
export async function getAuthUser(event: H3Event): Promise<{ id: string; email?: string } | null> {
  // Try the built-in helper first
  try {
    const user = await serverSupabaseUser(event)
    if (user?.id) return { id: user.id, email: (user as Record<string, unknown>).email as string | undefined }
  } catch {
    // getClaims() may fail on older token formats — fall through
  }

  // Fallback: use the client's getUser()
  try {
    const client = await serverSupabaseClient(event)
    const { data } = await client.auth.getUser()
    if (data?.user?.id) return { id: data.user.id, email: data.user.email }
  } catch {
    // no valid session
  }

  return null
}
