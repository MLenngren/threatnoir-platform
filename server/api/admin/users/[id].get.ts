import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

type ProfileRow = {
  user_id: string
  display_name: string | null
  is_blocked: boolean
  created_at: string
  updated_at: string
}

type ApiKeyItem = {
  id: string
  key_prefix: string
  name: string | null
  scopes: string[] | null
  last_used_at: string | null
  created_at: string | null
  revoked_at: string | null
}

type AuditItem = {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }

  const userRes = await supabase.auth.admin.getUserById(id)
  if (userRes.error) {
    console.error('[admin/users/[id].get] Supabase auth error:', userRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!userRes.data?.user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const [profileRes, keysRes, auditUserRes] = await Promise.all([
    supabase.from('profiles').select('user_id,display_name,is_blocked,created_at,updated_at').eq('user_id', id).maybeSingle<ProfileRow>(),
    supabase
      .from('api_keys')
      .select('id,key_prefix,name,scopes,last_used_at,created_at,revoked_at')
      .eq('user_id', id)
			.order('created_at', { ascending: false }),
    supabase
      .from('audit_log')
      .select('id,user_id,action,resource_type,resource_id,details,created_at')
      .eq('resource_type', 'user')
      .eq('resource_id', id)
      .order('created_at', { ascending: false })
			.limit(100)
  ])

  if (profileRes.error) {
    console.error('[admin/users/[id].get] DB error (profile):', profileRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (keysRes.error) {
    console.error('[admin/users/[id].get] DB error (api_keys):', keysRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (auditUserRes.error) {
    console.error('[admin/users/[id].get] DB error (audit_log):', auditUserRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Best-effort: fetch api_key audit entries filtered by details.user_id (may not be supported on all PostgREST configs)
  let auditApiKeys: AuditItem[] = []
  try {
    const apiKeyAuditRes = await supabase
      .from('audit_log')
      .select('id,user_id,action,resource_type,resource_id,details,created_at')
      .eq('resource_type', 'api_key')
      .eq('details->>user_id', id)
      .order('created_at', { ascending: false })
			.limit(100)

    if (!apiKeyAuditRes.error) {
      auditApiKeys = apiKeyAuditRes.data ?? []
    }
  } catch {
    // ignore
  }

  const u = userRes.data.user
  return {
    user: {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: (u as unknown as Record<string, unknown>).last_sign_in_at as string | null,
      app_metadata: (u as unknown as Record<string, unknown>).app_metadata ?? null,
      user_metadata: (u as unknown as Record<string, unknown>).user_metadata ?? null
    },
    profile: profileRes.data ?? null,
    apiKeys: (keysRes.data ?? []) as ApiKeyItem[],
    audit: {
      user: (auditUserRes.data ?? []) as AuditItem[],
      api_keys: auditApiKeys
    }
  }
})
