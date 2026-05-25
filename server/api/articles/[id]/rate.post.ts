import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../../utils/rateLimit'

type RateBody = {
  visitor_hash?: string
  score?: number
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`articles:rate:${ip}`, 10, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing article id' })
  }

  const body = await readBody<RateBody>(event)
  const visitorHash = (body?.visitor_hash ?? '').trim()
  const score = body?.score

  if (!visitorHash) {
    throw createError({ statusCode: 400, statusMessage: 'Missing visitor_hash' })
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(visitorHash)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid visitor hash format' })
  }

  if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 10) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid score (must be integer 1-10)' })
  }

  const articleRes = await supabase.from('articles').select('id,status').eq('id', id).maybeSingle()
  if (articleRes.error) {
		console.error('[articles/rate.post] DB error:', articleRes.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!articleRes.data || articleRes.data.status !== 'approved') {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const upsertRes = await supabase.from('verifications').upsert(
    {
      article_id: id,
      visitor_hash: visitorHash,
      score: score as number,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'article_id,visitor_hash' }
  )

  if (upsertRes.error) {
		console.error('[articles/rate.post] DB error:', upsertRes.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const updatedRes = await supabase.from('articles').select('avg_score,score_count').eq('id', id).maybeSingle()
  if (updatedRes.error || !updatedRes.data) {
		console.error('[articles/rate.post] DB error:', updatedRes.error?.message ?? 'unknown error')
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { avg_score: updatedRes.data.avg_score, score_count: updatedRes.data.score_count }
})
