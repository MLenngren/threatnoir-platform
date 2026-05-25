import { serverSupabaseServiceRole } from '#supabase/server'
import { createError, type H3Event } from 'h3'

import { getAuthUser } from './getAuthUser'

export async function requireAdminUser(event: H3Event) {
  const authUser = await getAuthUser(event)
  if (!authUser) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Fetch full user to read app_metadata.role (JWT claims can be unavailable for some token formats)
  const userRes = await supabase.auth.admin.getUserById(authUser.id)
  if (userRes.error) {
    console.error('[requireAdminUser] Supabase auth error:', userRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  const user = userRes.data?.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role
  if (role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return { user, supabase }
}
