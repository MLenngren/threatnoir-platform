import { createError, defineEventHandler, readBody } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'

type Body = {
  username?: string
  display_name?: string | null
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const body = (await readBody(event)) as Body

  const username = typeof body?.username === 'string' ? body.username.trim().replace(/^@/, '') : ''
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : null

  if (!username) throw createError({ statusCode: 400, statusMessage: 'Missing username' })
  if (username.length > 64) throw createError({ statusCode: 400, statusMessage: 'username too long' })
  if (!/^[A-Za-z0-9_]+$/.test(username)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid username format' })
  }

  const { data, error } = await supabase
    .from('x_accounts')
    .insert({ username, display_name: displayName })
    .select('id,username,display_name,is_active,created_at')
    .single()

	if (error) {
		console.error('[admin/x-accounts.post] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { account: data }
})
