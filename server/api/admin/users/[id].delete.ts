import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { writeAuditLog } from '../../../utils/auditLog'
import { UUID_REGEX } from '../../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const { supabase, user: admin } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()

  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }
  if (id === admin.id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete your own account' })
  }

  // Best-effort: fetch email for audit details
  const targetRes = await supabase.auth.admin.getUserById(id)
  const targetEmail = targetRes.data?.user?.email ?? null

  // Revoke all active keys first (best-effort)
  const revokeRes = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', id)
    .is('revoked_at', null)

  if (revokeRes.error) {
    console.error('[admin/users/[id].delete] DB error (revoke keys):', revokeRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const delRes = await supabase.auth.admin.deleteUser(id)
  if (delRes.error) {
    console.error('[admin/users/[id].delete] Supabase auth error:', delRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Unable to delete user' })
  }

  await writeAuditLog({
    user_id: admin.id,
    action: 'users.delete',
    resource_type: 'user',
    resource_id: id,
    details: { email: targetEmail }
  })

  return { ok: true }
})
