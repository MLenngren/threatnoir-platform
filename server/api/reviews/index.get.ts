import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`reviews:index:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const query = getQuery<{
    from?: string
    to?: string
  }>(event)

  function normalizeDateParam(name: 'from' | 'to', value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null

    // Allow full ISO (YYYY-MM-DDTHH:MM:SSZ) by taking the YYYY-MM-DD prefix.
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
    if (!m) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} date` })
    }
    return m[1]
  }

  const from = normalizeDateParam('from', query.from)
  const to = normalizeDateParam('to', query.to)

  let db = supabase
    .from('podcast_episodes')
    .select('date, edition, title, article_count, audio_url, created_at')
    .not('article_text', 'is', null)
    .order('date', { ascending: false })
    .order('edition', { ascending: true })

  if (from) db = db.gte('date', from)
  if (to) db = db.lte('date', to)

  const { data, error } = await db

  if (error) {
		console.error('[reviews/index.get] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: data ?? [] }
})
