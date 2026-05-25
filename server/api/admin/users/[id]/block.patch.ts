import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { requireAdminUser } from '../../../../utils/requireAdmin'
import { writeAuditLog } from '../../../../utils/auditLog'
import { UUID_REGEX } from '../../../../utils/subscriptions'

type Body = {
  is_blocked?: unknown
}

type ProfileRow = {
  user_id: string
  display_name: string | null
  is_blocked: boolean
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const { supabase, user: admin } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }

  const body = (await readBody(event)) as Body
  if (typeof body?.is_blocked !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Missing is_blocked' })
  }

  const upsertRes = await supabase
    .from('profiles')
    .upsert({ user_id: id, is_blocked: body.is_blocked }, { onConflict: 'user_id' })
    .select('user_id,display_name,is_blocked,created_at,updated_at')
    .single<ProfileRow>()

  if (upsertRes.error) {
    console.error('[admin/users/[id]/block.patch] DB error:', upsertRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  await writeAuditLog({
    user_id: admin.id,
    action: body.is_blocked ? 'users.block' : 'users.unblock',
    resource_type: 'user',
    resource_id: id,
    details: { is_blocked: body.is_blocked }
  })

  return { profile: upsertRes.data }
})
