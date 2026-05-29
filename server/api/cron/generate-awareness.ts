import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { useSupabaseAdmin } from '../../utils/supabase'
import { safeCompare } from '../../utils/safeCompare'
import { generateAwarenessLessons } from '../../utils/awarenessGenerator'

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

  // In compose, the app calls the internal ai-gateway instead of Anthropic directly.
  // Only require ANTHROPIC_API_KEY when we're using the direct-Anthropic path.
  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (!gatewayUrl && !process.env.ANTHROPIC_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured' })
  }

  const supabase = useSupabaseAdmin()
  return await generateAwarenessLessons(supabase)
})
