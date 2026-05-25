import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

type ShowEpisodesQuery = {
  limit?: string
  offset?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`show:episodes:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const query = getQuery<ShowEpisodesQuery>(event)
  const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 50)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)

  const supabase = serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('video_briefings')
		.select('id,slug,summary,date,title,duration_seconds,video_url,thumbnail_url,script')
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[show/episodes.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items = data ?? []
  return {
    items,
    hasMore: items.length === limit,
    nextOffset: offset + items.length
  }
})
