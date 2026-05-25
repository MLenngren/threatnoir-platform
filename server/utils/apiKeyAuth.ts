import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { hashApiKey } from './userApiKey'

type AuthResult = { userId: string; keyId: string }

/**
 * Authenticate an API key from the Authorization header.
 * Returns the user/key info if valid, null if no key was sent.
 * THROWS 401 if a key was sent but is invalid or revoked.
 */
export async function authenticateApiKey(
  event: H3Event
): Promise<AuthResult | null> {
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(tn_live_.+)$/)?.[1]
  if (!bearer) return null // no key sent — not an error

  const hash = hashApiKey(bearer)
  const supabase = serverSupabaseServiceRole(event)

  // Check if key exists at all (including revoked)
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle()

  if (error) {
    console.error('[authenticateApiKey] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Key not found
  if (!data) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid API key' })
  }

  // Key is revoked
  if (data.revoked_at) {
    throw createError({ statusCode: 401, statusMessage: 'API key has been revoked' })
  }

  // Blocked users cannot authenticate via API key
  const profileRes = await supabase
    .from('profiles')
    .select('is_blocked')
    .eq('user_id', data.user_id)
    .maybeSingle<{ is_blocked: boolean }>()

  if (profileRes.error) {
    console.error('[authenticateApiKey] DB error (profiles):', profileRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (profileRes.data?.is_blocked) {
    throw createError({ statusCode: 403, statusMessage: 'User is blocked' })
  }

  // Update last_used_at (best-effort but awaited — serverless kills fire-and-forget)
  try {
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
  } catch {
    // non-critical
  }

  return { userId: data.user_id, keyId: data.id }
}
