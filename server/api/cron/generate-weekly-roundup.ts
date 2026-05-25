import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { generateWeeklyRoundupDraft } from '../../utils/weeklyRoundup'
import { pingOps } from '../../utils/discordOps'

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

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const supabase = useSupabaseAdmin()

  try {
    const res = await generateWeeklyRoundupDraft({ supabase })

    // Best-effort ping. Always non-blocking.
    if (res.created) {
      await pingOps(
        `🟢 ThreatNoir ${res.week_label} roundup published\n` +
          `Read: https://threatnoir.com/weekly/${res.slug}\n` +
          `Email goes out at 08:00 UTC.`
      )
    } else if (res.skipped_reason === 'already_exists') {
      await pingOps(`⚪ ThreatNoir weekly roundup skipped (already exists for ${res.week_label}).`)
    } else {
      await pingOps(
        `🚨 ThreatNoir weekly roundup generation skipped\n` +
          `Reason: ${res.skipped_reason || 'unknown'}\n` +
          `Email cron will fall back to most recent published roundup.`
      )
    }

    return res
  } catch (err) {
    await pingOps(
      `🚨 ThreatNoir weekly roundup generation FAILED\n` +
        `Reason: ${err instanceof Error ? err.message : String(err)}`
    )
    throw err
  }
})
