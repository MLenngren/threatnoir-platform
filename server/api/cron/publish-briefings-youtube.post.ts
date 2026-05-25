import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'

const requireCronSecret = (event: H3Event) => {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET is not configured' })
  }

  const headerSecret = getHeader(event, 'x-cron-secret')
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  const provided = headerSecret || bearer

  if (!provided || !safeCompare(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  // Option A (LEN-1761): This endpoint ONLY surfaces unpublished rows.
  // It does NOT call YouTube APIs (Vercel can't reliably run `op` + Python OAuth flow).

  const supabase = useSupabaseAdmin()
  const since = toIsoDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))

  const { data, error } = await supabase
    .from('video_briefings')
    .select('id')
    .eq('audience', 'soc')
    .is('youtube_video_id', null)
    .not('video_url', 'is', null)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[cron/publish-briefings-youtube] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const ids = (data ?? [])
    .map((r) => (r && typeof r === 'object' ? String((r as Record<string, unknown>).id ?? '') : ''))
    .filter(Boolean)

  return ids
})
