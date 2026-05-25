import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { useSupabaseAdmin } from '../../utils/supabase'
import { estimateCallCostTenthsCents } from '../../utils/anthropic'
import { aiLimits, checkAiQuota } from '../../utils/aiUsage'
import { processArticleAi } from '../../utils/articleAiProcessor'
import { generateAwarenessLessons } from '../../utils/awarenessGenerator'
import { safeCompare } from '../../utils/safeCompare'
import { linkRelatedArticles } from '../../utils/relatedArticles'
import { refreshFocusItems } from '../../utils/autoFocus'

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

  if (process.env.AI_ENABLED === 'false') {
    return {
      processed: 0,
      skipped: 0,
      errors: [],
      quota: {
        calls_today: 0,
        daily_limit: aiLimits().dailyLimitCalls,
        monthly_spend_cents: 0,
        reason: 'AI disabled via kill switch'
      }
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured' })
  }

  const supabase = useSupabaseAdmin()

  const quota = await checkAiQuota()
  const { dailyLimitCalls, monthlyBudgetCents } = aiLimits()
  const monthlyBudgetTenths = monthlyBudgetCents * 10
  if (!quota.allowed) {
    return {
      processed: 0,
      skipped: 0,
      errors: [],
      quota: {
        calls_today: quota.todayCalls,
        daily_limit: dailyLimitCalls,
        monthly_spend_cents: Number((quota.monthSpendTenthsCents / 10).toFixed(1)),
        reason: quota.reason
      }
    }
  }

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id,title,summary,url,published_at,image_url')
    .eq('status', 'pending')
    .is('ai_summary', null)
    .limit(50)

  if (error) {
		console.error('[cron/summarize] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  let processed = 0
  let skipped = 0
  const errors: Array<{ id: string; error: string }> = []

  let callsToday = quota.todayCalls
  let monthSpendTenths = quota.monthSpendTenthsCents
  let stopReason: string | undefined
  let linkRelated: unknown = null

  const approveThresholdRaw = Number(process.env.AI_AUTO_APPROVE_THRESHOLD || 8)
  const rejectThresholdRaw = Number(process.env.AI_AUTO_REJECT_THRESHOLD || 3)
  const approveThreshold = Number.isFinite(approveThresholdRaw) ? approveThresholdRaw : 8
  const rejectThreshold = Number.isFinite(rejectThresholdRaw) ? rejectThresholdRaw : 3

  for (const a of articles ?? []) {
    // Local quota check to stop mid-batch without extra DB reads
    if (callsToday >= dailyLimitCalls) {
      stopReason = `Daily limit reached (${dailyLimitCalls})`
      break
    }
    if (monthSpendTenths >= monthlyBudgetTenths) {
      stopReason = `Monthly budget exceeded ($${(monthlyBudgetCents / 100).toFixed(2)})`
      break
    }

    const title = (a.title || '').trim()
    if (!title) {
      skipped++
      continue
    }

	    try {
	      const res = await processArticleAi(supabase, a.id, {
	        overwriteStatus: true,
	        approveThreshold,
	        rejectThreshold
	      })

	      if (!res.ok) {
	        if (res.error === 'no_update') {
	          skipped += 1
	          continue
	        }
	        throw new Error(res.error || 'AI processing failed')
	      }

	      const costTenths = estimateCallCostTenthsCents()
	      callsToday += 1
	      monthSpendTenths += costTenths
	      processed += 1
	    } catch (e) {
	      const msg = e instanceof Error ? e.message : String(e)
	      errors.push({ id: a.id, error: msg })
	    }
	  }

	// Post-processing: attempt to link newly-summarized articles to prior coverage.
	// Keep this best-effort; failures should not fail the entire summarize batch.
	try {
		linkRelated = await linkRelatedArticles(supabase, {
			maxPerRun: 20,
			windowHours: 24,
			lookbackDays: 14,
			requireAiSummary: true,
			enableLlmTiebreaker: true,
			maxLlmCalls: 3
		})
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		console.error('[cron/summarize] link-related error:', msg)
		linkRelated = { error: msg }
	}

	// Post-processing: generate awareness lessons from newly summarized articles.
	// Best-effort; failures should not fail the summarize batch.
	let awarenessResult: unknown = null
		try {
			awarenessResult = await generateAwarenessLessons(supabase)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			console.error('[cron/summarize] generate-awareness error:', msg)
			awarenessResult = { error: msg }
		}

		// Post-processing: auto-refresh focus items (best-effort)
		let focusResult: unknown = null
		try {
			focusResult = await refreshFocusItems(supabase)
			const fr = focusResult as Record<string, unknown>
			if (fr.created || fr.archived) {
				console.log(`[cron/summarize] focus: created=${fr.created} archived=${fr.archived}`)
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			console.error('[cron/summarize] focus auto-refresh error:', msg)
			focusResult = { error: msg }
		}

  return {
    processed,
    skipped,
    errors,
		link_related: linkRelated,
		awareness: awarenessResult,
		focus: focusResult,
    quota: {
      calls_today: callsToday,
      daily_limit: dailyLimitCalls,
      monthly_spend_cents: Number((monthSpendTenths / 10).toFixed(1)),
      reason: stopReason
    }
  }
})
