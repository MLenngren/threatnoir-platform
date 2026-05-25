import { createError, defineEventHandler } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'
import { getAuthUser } from '../../utils/getAuthUser'

type ApiKeyItem = {
  id: string
  key_prefix: string
  name: string | null
  scopes: string[] | null
  last_used_at: string | null
  created_at: string | null
  revoked_at: string | null
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
    console.error('[user/api-keys.get] DB error (profiles):', profileRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (profileRes.data?.is_blocked) {
    throw createError({ statusCode: 403, statusMessage: 'User is blocked' })
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id,key_prefix,name,scopes,last_used_at,created_at,revoked_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[user/api-keys.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: (data ?? []) as ApiKeyItem[] }
})
