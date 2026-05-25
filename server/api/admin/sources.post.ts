import { defineEventHandler, readBody, createError } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'
import { UrlBlockedError, validateUrlSafe } from '../../utils/ssrf'
import { writeAuditLog } from '../../utils/auditLog'

type Body = {
  name?: string
  url?: string
	  type?: 'rss' | 'api' | 'community' | 'reddit'
}

export default defineEventHandler(async (event) => {
  const { supabase, user } = await requireAdminUser(event)
  const body = (await readBody(event)) as Body

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  const type = body?.type ?? 'rss'

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing name' })
  if (!url) throw createError({ statusCode: 400, statusMessage: 'Missing url' })
	if (!['rss', 'api', 'community', 'reddit'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid type' })
  }

  try {
    await validateUrlSafe(url)
  } catch (err: unknown) {
    if (err instanceof UrlBlockedError) {
      throw createError({ statusCode: 400, statusMessage: err.message })
    }
    throw err
  }

  const { data, error } = await supabase
    .from('sources')
    .insert({ name, url, type })
    .select('id,name,url,type,is_active,last_fetched_at')
    .single()

	if (error) {
		console.error('[admin/sources.post] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  await writeAuditLog({
    user_id: user.id,
    action: 'sources.create',
    resource_type: 'source',
    resource_id: data.id,
    details: { name, url, type }
  })

  return { source: data }
})
