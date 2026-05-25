import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../../utils/rateLimit'

type MyRatingQuery = {
  visitor_hash?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`articles:my-rating:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing article id' })
  }

  const query = getQuery<MyRatingQuery>(event)
  const visitorHash = (query.visitor_hash ?? '').trim()

  if (!visitorHash) {
    throw createError({ statusCode: 400, statusMessage: 'Missing visitor_hash' })
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(visitorHash)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid visitor hash format' })
  }

  const articleRes = await supabase.from('articles').select('id,status').eq('id', id).maybeSingle()
  if (articleRes.error) {
		console.error('[articles/my-rating.get] DB error:', articleRes.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!articleRes.data || articleRes.data.status !== 'approved') {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const res = await supabase
    .from('verifications')
    .select('score')
    .eq('article_id', id)
    .eq('visitor_hash', visitorHash)
    .maybeSingle()

  if (res.error) {
		console.error('[articles/my-rating.get] DB error:', res.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { score: res.data?.score ?? null }
})
