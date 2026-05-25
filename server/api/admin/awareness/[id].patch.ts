import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Body = {
  status?: 'published' | 'draft'
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing lesson id' })

  const body = (await readBody(event)) as Body
  const status = body?.status === 'published' ? 'published' : 'draft'

  const patch: Record<string, unknown> = {
    status,
    published_at: status === 'published' ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('awareness_lessons')
    .update(patch)
    .eq('id', id)
    .select('id,status,published_at')
    .maybeSingle()

  if (error) {
    console.error('[admin/awareness/[id].patch] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Lesson not found' })

  return { lesson: data }
})
