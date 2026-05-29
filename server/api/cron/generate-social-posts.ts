import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import type { H3Event } from 'h3'

import Anthropic from '@anthropic-ai/sdk'

import { useSupabaseAdmin } from '../../utils/supabase'
import { safeCompare } from '../../utils/safeCompare'
import { aiLimits, checkAiQuota, logAiCall } from '../../utils/aiUsage'
import { notifyAdmin } from '../../utils/notifyAdmin'
import { getSiteConfig } from '../../utils/siteConfig'

const HOOKS = [
  '3 threats from the last 48 hours:',
  'What security teams are dealing with today:',
  'This week in threat intel:',
  'On the radar this week:',
  '3 stories you should brief your team on:',
  'Your threat briefing for today:'
] as const

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

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in response')
  return JSON.parse(m[0])
}

function pickHook(recentHooks: string[]): string {
  const recent = new Set(recentHooks.map((h) => (h || '').trim()).filter(Boolean))
  for (const h of HOOKS) {
    if (!recent.has(h)) return h
  }
  return HOOKS[0]
}

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

type CandidateArticle = {
  id: string
  title: string
  ai_summary: string | null
  summary: string | null
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  if (process.env.AI_ENABLED === 'false') {
    return { generated: false, reason: 'ai_disabled' }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured' })
  }

  const supabase = useSupabaseAdmin()

  const quota = await checkAiQuota()
  const { dailyLimitCalls } = aiLimits()
  if (!quota.allowed) {
    return {
      generated: false,
      reason: quota.reason,
      quota: {
        calls_today: quota.todayCalls,
        daily_limit: dailyLimitCalls,
        monthly_spend_cents: Number((quota.monthSpendTenthsCents / 10).toFixed(1))
      }
    }
  }

  // Optional: accept specific article_ids from admin to override auto-selection.
  let forcedArticleIds: string[] | null = null
  try {
    const body = await readBody(event)
    if (body && Array.isArray(body.article_ids)) {
      const ids = body.article_ids.filter((id: unknown) => typeof id === 'string' && id)
      if (ids.length >= 1) forcedArticleIds = ids.slice(0, 5)
    }
  } catch {
    // No body or invalid — that's fine, use auto-selection.
  }

  const cutoff7dIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let candidates: CandidateArticle[]

  if (forcedArticleIds) {
    // Admin selected specific articles — fetch those directly.
    const { data: forcedArticles, error: forcedErr } = await supabase
      .from('articles')
      .select('id,title,ai_summary,summary')
      .in('id', forcedArticleIds)
      .eq('status', 'approved')
      .limit(5)

    if (forcedErr) {
      console.error('[cron/generate-social-posts] DB error (forced articles):', forcedErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    candidates = []
    for (const row of (forcedArticles ?? []) as unknown[]) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      const id = typeof rec.id === 'string' ? rec.id : ''
      const title = typeof rec.title === 'string' ? rec.title.trim() : ''
      if (!id || !title) continue
      candidates.push({
        id,
        title,
        ai_summary: typeof rec.ai_summary === 'string' ? rec.ai_summary : null,
        summary: typeof rec.summary === 'string' ? rec.summary : null
      })
    }

    if (candidates.length === 0) {
      return { generated: false, reason: 'no_valid_articles_from_selection' }
    }
  } else {
    // Auto-selection: recent high-relevance articles, excluding already-featured.
    const cutoff48hIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const { data: rawArticles, error: articlesErr } = await supabase
      .from('articles')
      .select('id,title,ai_summary,summary,relevance_score,published_at,ingested_at')
      .eq('status', 'approved')
      .gte('relevance_score', 7)
      .or(`published_at.gte.${cutoff48hIso},ingested_at.gte.${cutoff48hIso}`)
      .order('relevance_score', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('ingested_at', { ascending: false })
      .limit(50)

    if (articlesErr) {
      console.error('[cron/generate-social-posts] DB error (articles):', articlesErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const { data: recentDrafts, error: draftsErr } = await supabase
      .from('social_drafts')
      .select('article_ids')
      .gte('created_at', cutoff7dIso)
      .limit(200)

    if (draftsErr) {
      console.error('[cron/generate-social-posts] DB error (social_drafts):', draftsErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const featuredIds = new Set<string>()
    for (const row of (recentDrafts ?? []) as unknown[]) {
      if (!row || typeof row !== 'object') continue
      const ids = (row as Record<string, unknown>).article_ids
      if (!Array.isArray(ids)) continue
      for (const id of ids) {
        if (typeof id === 'string' && id) featuredIds.add(id)
      }
    }

    candidates = []
    for (const row of (rawArticles ?? []) as unknown[]) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      const id = typeof rec.id === 'string' ? rec.id : ''
      const title = typeof rec.title === 'string' ? rec.title.trim() : ''
      if (!id || !title) continue
      if (featuredIds.has(id)) continue

      candidates.push({
        id,
        title,
        ai_summary: typeof rec.ai_summary === 'string' ? rec.ai_summary : null,
        summary: typeof rec.summary === 'string' ? rec.summary : null
      })
    }

    if (candidates.length < 3) {
      return { generated: false, reason: 'insufficient_articles', available: candidates.length }
    }
  }

  const { data: recentHooksRows, error: hooksErr } = await supabase
    .from('social_drafts')
    .select('hook_text,created_at')
    .gte('created_at', cutoff7dIso)
    .order('created_at', { ascending: false })
    .limit(3)

  if (hooksErr) {
    console.error('[cron/generate-social-posts] DB error (hooks):', hooksErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const recentHooks = (recentHooksRows ?? [])
    .map((r) => (r && typeof r === 'object' ? normalizeString((r as Record<string, unknown>).hook_text) : ''))
    .filter(Boolean)
    .slice(0, 3)

  const hookText = pickHook(recentHooks)
	const site = getSiteConfig()
	const siteHost = new URL(site.url).host

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const articlesForPrompt = candidates.slice(0, 20).map((a) => ({
    id: a.id,
    title: a.title,
    summary: (a.ai_summary || a.summary || '').slice(0, 500)
  }))

	const prompt = `You are ${site.name}'s social media writer. Pick the 3 most interesting and diverse stories from the provided articles and write social media posts.

Rules:
- Practitioner voice, not marketing. Direct and useful.
- No em dashes anywhere. Use periods, colons, or pipes instead.
- Each story gets a one-line summary with the "so what" angle.
	- Link to ${siteHost} (not individual article URLs).
- Max 3-4 hashtags: #cybersecurity #threatintel and 1-2 topic-specific ones.
- Pick diverse stories. Avoid 3 of the same category.

Return ONLY valid JSON:
{
  "article_ids": ["uuid1", "uuid2", "uuid3"],
  "text_x": "<X/Twitter version, MUST be under 280 characters including link and hashtags>",
  "text_linkedin": "<LinkedIn version, longer format with bold titles and context>"
}

Hook text to use (vary from previous posts): "${hookText}"
Do NOT use any of these recent hooks: ${recentHooks.length ? recentHooks.map((h) => `"${h}"`).join(', ') : '(none)'}

Available hooks (pick one):
${HOOKS.map((h) => `- "${h}"`).join('\n')}

Available articles (choose exactly 3):
${JSON.stringify(articlesForPrompt, null, 2)}
`

	  const model = 'claude-haiku-4-5-20251001'
	  const startedAt = Date.now()
	  const resp = await client.messages.create({
	    model,
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }]
  })

	  await logAiCall({
	    pipeline: 'social_post_generate',
	    model,
	    response: resp,
	    durationMs: Date.now() - startedAt,
	    metadata: {
	      hook_text: hookText,
	      candidate_count: candidates.length
	    }
	  })

  const text = resp.content?.[0]?.type === 'text' ? resp.content[0].text : ''
  const parsed = extractJson(text) as Record<string, unknown>

  const rawIds = Array.isArray(parsed.article_ids) ? parsed.article_ids : []
  const requestedIds = rawIds
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)

  const candidateIdSet = new Set(candidates.map((a) => a.id))
  const articleIds = Array.from(new Set(requestedIds.filter((id) => candidateIdSet.has(id)))).slice(0, 3)
  if (articleIds.length < 3) {
    // Fallback: pick top remaining candidates if model selected invalid IDs.
    for (const a of candidates) {
      if (articleIds.length >= 3) break
      if (!articleIds.includes(a.id)) articleIds.push(a.id)
    }
  }

  let textX = normalizeString(parsed.text_x)
  const textLinkedIn = normalizeString(parsed.text_linkedin)

  if (!textX || !textLinkedIn) {
    throw createError({ statusCode: 500, statusMessage: 'Model response missing text_x or text_linkedin' })
  }

  // Hard enforcement: ensure X text fits.
  if (textX.length > 280) {
    const shortenPrompt = `Shorten this X post to be under 280 characters total.
Rules:
- Keep the same 3 numbered items.
	- Keep the final line with "${siteHost}".
- Keep 2-4 hashtags.
- No em dashes.

Return ONLY valid JSON: { "text_x": "..." }

Post:
${textX}`

	    const model2 = 'claude-haiku-4-5-20251001'
	    const startedAt2 = Date.now()
	    const resp2 = await client.messages.create({
	      model: model2,
      max_tokens: 200,
      messages: [{ role: 'user', content: shortenPrompt }]
    })
	    await logAiCall({
	      pipeline: 'social_post_shorten',
	      model: model2,
	      response: resp2,
	      durationMs: Date.now() - startedAt2,
	      metadata: {
	        original_length: textX.length
	      }
	    })
    const t2 = resp2.content?.[0]?.type === 'text' ? resp2.content[0].text : ''
    const p2 = extractJson(t2) as Record<string, unknown>
    const shortened = normalizeString(p2.text_x)
    if (shortened && shortened.length <= 280) textX = shortened
  }

  if (textX.length > 280) {
    throw createError({ statusCode: 500, statusMessage: `Generated X text exceeds 280 chars (${textX.length})` })
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('social_drafts')
    .insert({
      platform: 'both',
      text_x: textX,
      text_linkedin: textLinkedIn,
      article_ids: articleIds,
      status: 'pending',
      hook_text: hookText
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[cron/generate-social-posts] DB error (insert):', insertErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  await notifyAdmin('social_draft_ready', { id: inserted.id, hook: hookText })

  return {
    generated: true,
    id: inserted.id,
    article_ids: articleIds,
    hook: hookText
  }
})
