import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { linkRelatedArticles } from '../../utils/relatedArticles'

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

  // Keep it lightweight — false negatives are acceptable, false positives are worse.
  const res = await linkRelatedArticles(supabase, {
    maxPerRun: 20,
    windowHours: 24,
    lookbackDays: 14,
    requireAiSummary: false,
    enableLlmTiebreaker: true,
    maxLlmCalls: 5
  })

  return res
})
