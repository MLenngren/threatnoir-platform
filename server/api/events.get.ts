import { createError, defineEventHandler, getQuery } from 'h3'

import { useSupabaseAdmin } from '../utils/supabase'

type EventsQuery = {
  category?: string
  audience?: string
  include_past?: string
  limit?: string
  offset?: string
}

const VALID_CATEGORIES = new Set(['conference', 'workshop', 'webinar', 'ctf', 'meetup'])
const VALID_AUDIENCES = new Set([
  'leadership', 'soc', 'offensive', 'iam', 'grc', 'cloud', 'appsec',
  'ot-iot', 'threat-intel', 'general', 'privacy', 'ai-security'
])

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isTrue(v: string | null | undefined): boolean {
  return (v || '').trim().toLowerCase() === 'true'
}

export default defineEventHandler(async (event) => {
  const supabase = useSupabaseAdmin()
  const query = getQuery<EventsQuery>(event)

  const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 100)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)

  const categoryRaw = (query.category ?? '').trim().toLowerCase()
  const category = categoryRaw && VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : null
  const audienceRaw = (query.audience ?? '').trim().toLowerCase()
  const audience = audienceRaw && VALID_AUDIENCES.has(audienceRaw) ? audienceRaw : null
  const includePast = isTrue(query.include_past)

  const todayIso = toIsoDate(new Date())

  const selectFields = [
    'id',
    'title',
    'slug',
    'description',
    'url',
    'start_date',
    'end_date',
    'location',
    'is_virtual',
    'organizer',
    'category',
    'tags',
    'audience',
    'source_name',
    'created_at'
  ].join(',')

  const buildBase = () => {
    let q = supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'approved')

    if (!includePast) {
      q = q.or(`start_date.gte.${todayIso},end_date.gte.${todayIso}`)
    }
    if (category) {
      q = q.eq('category', category)
    }
    if (audience) {
      q = q.eq('audience', audience)
    }
    return q
  }

  const countRes = await buildBase()
  if (countRes.error) {
    console.error('[events.get] DB error (count):', countRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  let itemsQ = supabase.from('events').select(selectFields).eq('status', 'approved')
  if (!includePast) {
    itemsQ = itemsQ.or(`start_date.gte.${todayIso},end_date.gte.${todayIso}`)
  }
  if (category) {
    itemsQ = itemsQ.eq('category', category)
  }
  if (audience) {
    itemsQ = itemsQ.eq('audience', audience)
  }

  const { data, error } = await itemsQ
    .order('start_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[events.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return {
    items: data ?? [],
    total: countRes.count ?? 0
  }
})
