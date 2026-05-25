import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Body = {
  text_x?: unknown
  text_linkedin?: unknown
}

function normalizeText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw new Error('Missing social draft id')

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}

  if ('text_x' in body) {
    const t = normalizeText(body.text_x)
    if (typeof t === 'string' && t.length > 280) {
      throw createError({ statusCode: 400, statusMessage: 'text_x must be <= 280 characters' })
    }
    patch.text_x = t
  }

  if ('text_linkedin' in body) {
    patch.text_linkedin = normalizeText(body.text_linkedin)
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  const { data, error } = await supabase
    .from('social_drafts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[admin/social/[id].patch] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { draft: data }
})
