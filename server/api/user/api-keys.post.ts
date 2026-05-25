import { createError, defineEventHandler, readBody } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { generateApiKey } from '../../utils/userApiKey'
import { normalizeText } from '../../utils/subscriptions'
import { getAuthUser } from '../../utils/getAuthUser'
import { notifyAdmin } from '../../utils/notifyAdmin'

type Body = {
  name?: unknown
}

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const profileRes = await supabase
    .from('profiles')
    .select('is_blocked')
    .eq('user_id', user.id)
    .maybeSingle<{ is_blocked: boolean }>()

  if (profileRes.error) {
    console.error('[user/api-keys.post] DB error (profiles):', profileRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (profileRes.data?.is_blocked) {
    throw createError({ statusCode: 403, statusMessage: 'User is blocked' })
  }

  const body = await readBody<Body>(event)
  const name = normalizeText(body?.name, 100) || null

  const countRes = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if (countRes.error) {
    console.error('[user/api-keys.post] DB error (count):', countRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const activeCount = countRes.count ?? 0
  if (activeCount >= 5) {
    throw createError({ statusCode: 400, statusMessage: 'API key limit reached (max 5)' })
  }

  const { key, hash, prefix } = generateApiKey()

  const insertRes = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      key_hash: hash,
      key_prefix: prefix,
      name,
      scopes: ['ioc:read']
    })
    .select('id,key_prefix,name')
    .single()

  if (insertRes.error) {
    console.error('[user/api-keys.post] DB error (insert):', insertRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  notifyAdmin('api_key_created', {
    email: user.email || 'unknown',
    key_name: name || '(unnamed)',
    key_prefix: prefix,
    timestamp: new Date().toISOString()
  }).catch(() => {})

  return {
    id: insertRes.data.id,
    key,
    key_prefix: insertRes.data.key_prefix,
    name: insertRes.data.name
  }
})
