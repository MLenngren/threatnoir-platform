import { createError, defineEventHandler, getRouterParam } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { UUID_REGEX } from '../../../utils/subscriptions'
import { getAuthUser } from '../../../utils/getAuthUser'
import { notifyAdmin } from '../../../utils/notifyAdmin'

type ApiKeyRow = {
  id: string
  user_id: string
  revoked_at: string | null
}

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key id' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const profileRes = await supabase
    .from('profiles')
    .select('is_blocked')
    .eq('user_id', user.id)
    .maybeSingle<{ is_blocked: boolean }>()

  if (profileRes.error) {
    console.error('[user/api-keys/[id].delete] DB error (profiles):', profileRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (profileRes.data?.is_blocked) {
    throw createError({ statusCode: 403, statusMessage: 'User is blocked' })
  }

  const lookup = await supabase
    .from('api_keys')
    .select('id,user_id,revoked_at')
    .eq('id', id)
    .maybeSingle<ApiKeyRow>()

  if (lookup.error) {
    console.error('[user/api-keys/[id].delete] DB error (lookup):', lookup.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (!lookup.data || lookup.data.user_id !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (!lookup.data.revoked_at) {
    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[user/api-keys/[id].delete] DB error (revoke):', error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    notifyAdmin('api_key_revoked', {
      email: user.email || 'unknown',
      key_id: id,
      timestamp: new Date().toISOString()
    }).catch(() => {})
  }

  return { ok: true }
})
