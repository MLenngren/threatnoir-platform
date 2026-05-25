import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../../../utils/requireAdmin'
import { writeAuditLog } from '../../../../../utils/auditLog'
import { UUID_REGEX } from '../../../../../utils/subscriptions'

type ApiKeyRow = {
  id: string
  user_id: string
  key_prefix: string
  revoked_at: string | null
}

export default defineEventHandler(async (event) => {
  const { supabase, user: admin } = await requireAdminUser(event)
  const userId = (getRouterParam(event, 'id') || '').trim()
  const keyId = (getRouterParam(event, 'keyId') || '').trim()

  if (!userId || !UUID_REGEX.test(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }
  if (!keyId || !UUID_REGEX.test(keyId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key id' })
  }

  const lookup = await supabase
    .from('api_keys')
    .select('id,user_id,key_prefix,revoked_at')
    .eq('id', keyId)
    .maybeSingle<ApiKeyRow>()

  if (lookup.error) {
    console.error('[admin/users/[id]/api-keys/[keyId].delete] DB error (lookup):', lookup.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!lookup.data || lookup.data.user_id !== userId) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  if (!lookup.data.revoked_at) {
    const revokeRes = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('user_id', userId)

    if (revokeRes.error) {
      console.error('[admin/users/[id]/api-keys/[keyId].delete] DB error (revoke):', revokeRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
  }

  await writeAuditLog({
    user_id: admin.id,
    action: 'api_keys.revoke',
    resource_type: 'api_key',
    resource_id: keyId,
    details: { user_id: userId, key_prefix: lookup.data.key_prefix }
  })

  return { ok: true }
})
