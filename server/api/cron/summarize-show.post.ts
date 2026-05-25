import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { checkAiQuota } from '../../utils/aiUsage'
import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { summarizeVideoBriefing } from '../../utils/videoBriefingSummary'

type VideoBriefingRow = {
  id: string
  title: string
  script: unknown
}

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

function scriptToText(script: unknown): string {
  if (typeof script === 'string') return script
  if (!script || typeof script !== 'object') return ''

  const s = script as Record<string, unknown>
  const parts: string[] = []

  if (typeof s.headline === 'string') {
    const h = s.headline.trim()
    if (h) parts.push(h)
  }

  if (Array.isArray(s.lines)) {
    for (const lineRaw of s.lines) {
      if (!lineRaw || typeof lineRaw !== 'object') continue
      const line = lineRaw as Record<string, unknown>
      const text = typeof line.text === 'string' ? line.text.trim() : ''
      if (text) parts.push(text)
    }
  }

  return parts.join(' ')
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const supabase = useSupabaseAdmin()

  const { data, error } = await supabase
    .from('video_briefings')
    .select('id,title,script')
    .is('summary', null)
    .not('script', 'is', null)
    .order('date', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[cron/summarize-show] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (data ?? []) as VideoBriefingRow[]

  let processed = 0
  let skipped = 0
  let errorsCount = 0
  let totalCostCents = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const quota = await checkAiQuota()
    if (!quota.allowed) {
      skipped += rows.length - i
      break
    }

    try {
      const title = (row.title || '').trim()
      const scriptText = scriptToText(row.script)
      if (!title || !scriptText) {
        skipped += 1
        continue
      }

      const res = await summarizeVideoBriefing(scriptText, title)
      totalCostCents += res.costCents

      const { data: updated, error: updateError } = await supabase
        .from('video_briefings')
        .update({ summary: res.summary })
        .eq('id', row.id)
        .is('summary', null)
        .select('id')

      if (updateError) {
        console.error('[cron/summarize-show] DB error (update):', updateError.message)
        throw new Error('Internal server error')
      }

      if (!updated?.length) {
        skipped += 1
        continue
      }

      processed += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/summarize-show] row error id=${row?.id}:`, msg)
      errorsCount += 1
    }
  }

  return {
    processed,
    skipped,
    errors: errorsCount,
    totalCostCents: Number(totalCostCents.toFixed(1))
  }
})
