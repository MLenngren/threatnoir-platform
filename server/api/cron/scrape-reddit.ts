import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { ingestRedditSources, type RedditSource } from '../../utils/redditIngest'

const MAX_ARTICLE_AGE_HOURS = Number(process.env.MAX_ARTICLE_AGE_HOURS) || 48

const requireCronSecret = (event: H3Event) => {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRON_SECRET is not configured'
    })
  }

  const headerSecret = getHeader(event, 'x-cron-secret')
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  const provided = headerSecret || bearer

  if (!provided || !safeCompare(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const supabase = useSupabaseAdmin()
  const { data: sources, error } = await supabase
    .from('sources')
    .select('id,name,url,type')
    .eq('is_active', true)
    .eq('type', 'reddit')

  if (error) {
    console.error('[cron/scrape-reddit] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const res = await ingestRedditSources({
    supabase,
    sources: (sources ?? []) as unknown as RedditSource[],
    maxArticleAgeHours: MAX_ARTICLE_AGE_HOURS,
    limitPerSubreddit: 25
  })

  return {
    fetched: res.fetched,
    new: res.created,
    skipped: res.skipped,
    stale: res.stale,
    errors: res.errors
  }
})
