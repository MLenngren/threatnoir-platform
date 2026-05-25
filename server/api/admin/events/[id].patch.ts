import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

type Body = {
  status?: unknown
  title?: unknown
  description?: unknown
  url?: unknown
  start_date?: unknown
  end_date?: unknown
  location?: unknown
  is_virtual?: unknown
  organizer?: unknown
  category?: unknown
}

const VALID_STATUSES = new Set(['pending', 'approved', 'rejected'])
const VALID_CATEGORIES = new Set(['conference', 'workshop', 'webinar', 'ctf', 'meetup'])

function cleanOptionalText(v: unknown, maxLen: number): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

function normalizeUrl(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (!s.startsWith('http://') && !s.startsWith('https://')) return null
  if (s.length > 2000) return null
  return s
}

function normalizeIsoDate(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid event id' })
  }

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}

  if (typeof body?.status === 'string') {
    const s = body.status.trim().toLowerCase()
    if (!VALID_STATUSES.has(s)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    }
    patch.status = s
  }

  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) throw createError({ statusCode: 400, statusMessage: 'Title cannot be empty' })
    if (title.length > 200) throw createError({ statusCode: 400, statusMessage: 'Title must be at most 200 characters' })
    patch.title = title
  }

  if (body?.description !== undefined) {
    patch.description = cleanOptionalText(body.description, 5000)
  }

  if (body?.url !== undefined) {
    const url = normalizeUrl(body.url)
    if (body.url && !url) {
      throw createError({ statusCode: 400, statusMessage: 'url must start with http(s)' })
    }
    patch.url = url
  }

  if (body?.start_date !== undefined) {
    const start = normalizeIsoDate(body.start_date)
    if (!start) throw createError({ statusCode: 400, statusMessage: 'start_date must be YYYY-MM-DD' })
    patch.start_date = start
  }

  if (body?.end_date !== undefined) {
    const end = normalizeIsoDate(body.end_date)
    patch.end_date = end
  }

  if (body?.location !== undefined) {
    patch.location = cleanOptionalText(body.location, 200)
  }

  if (body?.organizer !== undefined) {
    patch.organizer = cleanOptionalText(body.organizer, 200)
  }

  if (body?.category !== undefined) {
    const cat = typeof body.category === 'string' ? body.category.trim().toLowerCase() : ''
    if (cat && !VALID_CATEGORIES.has(cat)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid category' })
    }
    patch.category = cat || null
  }

  if (body?.is_virtual !== undefined) {
    if (typeof body.is_virtual !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'is_virtual must be boolean' })
    }
    patch.is_virtual = body.is_virtual
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  // If both dates are present, validate range.
  const startDate = typeof patch.start_date === 'string' ? (patch.start_date as string) : null
  const endDate = typeof patch.end_date === 'string' ? (patch.end_date as string) : null
  if (startDate && endDate && endDate < startDate) {
    throw createError({ statusCode: 400, statusMessage: 'end_date must be on/after start_date' })
  }

  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select('*').single()
  if (error) {
    console.error('[admin/events/[id].patch] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { item: data }
})
