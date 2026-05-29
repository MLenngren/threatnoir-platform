import { createError, defineEventHandler, getHeader, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { Resend } from 'resend'

import { checkAiQuota } from '../../utils/aiUsage'
import { emailRecipients, emailSenders } from '../../utils/emailConfig'
import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { formatWeeklyTweet, postTweet } from '../../utils/twitter'
import { getSiteConfig } from '../../utils/siteConfig'
import { draftLinkedinWeeklyPostDirect } from '../../utils/anthropic'

const requireCronSecret = (event: H3Event) => {
  const expected = process.env.CRON_SECRET
  if (!expected) throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET is not configured' })

  const headerSecret = getHeader(event, 'x-cron-secret')
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  const provided = headerSecret || bearer

  if (!provided || !safeCompare(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escapeHtml(input: string): string {
  return (input || '').replace(/[&<>"']/g, (ch) => HTML_ESC[ch] || ch)
}

function extractTopStories(fullBrief: string, limit: number): string[] {
  const out: string[] = []
  for (const line of (fullBrief || '').split(/\r?\n/)) {
    const m = line.trim().match(/^[-*]\s+\*\*\[([^\]]+)\]\([^)]+\)\*\*\.\s*(.+)$/)
    if (!m) continue
    const title = (m[1] || '').trim()
    const ctx = (m[2] || '').trim()
    if (title) out.push(`${title}: ${ctx.slice(0, 220)}`)
    if (out.length >= limit) break
  }
  return out
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const q = getQuery<{ force?: string }>(event)
  const force = String(q.force || '').toLowerCase() === 'true'
  const isMondayUtc = new Date().getUTCDay() === 1
  if (!isMondayUtc && !force) return { skipped: true, reason: 'Not Monday (UTC). Use ?force=true to run.' }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured' })
  }
  if (!process.env.RESEND_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'RESEND_API_KEY is not configured' })
  }

  const quota = await checkAiQuota()
  if (!quota.allowed) return { skipped: true, reason: quota.reason || 'AI quota exceeded' }

  const supabase = useSupabaseAdmin()
	const site = getSiteConfig()

  const weeklyRes = await supabase
    .from('weekly_roundups')
    .select('week_label,slug,tldr,full_brief,published_at,created_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (weeklyRes.error) {
    console.error('[cron/linkedin-draft] DB error (weekly_roundups):', weeklyRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  type WeeklyRow = { week_label: string; slug: string; tldr: string | null; full_brief: string | null }
  const weekly = (weeklyRes.data ?? [])[0] as WeeklyRow | undefined
  if (!weekly?.slug) throw createError({ statusCode: 404, statusMessage: 'No published weekly roundup found' })

  const nowIso = new Date().toISOString()
  const focusRes = await supabase
    .from('focus_items')
    .select('title,created_at,expires_at,status')
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(3)

  if (focusRes.error) {
    console.error('[cron/linkedin-draft] DB error (focus_items):', focusRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const focusTitles = (focusRes.data ?? [])
    .map((r) => (typeof (r as Record<string, unknown>).title === 'string' ? String((r as Record<string, unknown>).title).trim() : ''))
    .filter(Boolean)

  const stories = extractTopStories(weekly.full_brief || '', 6)
	const link = `${site.url}/weekly/${weekly.slug}`

  const userPrompt =
	    `Write a LinkedIn post about this week's ${site.name} roundup.\n\n` +
    `Week: ${weekly.week_label}\n\n` +
    `TLDR:\n${(weekly.tldr || '').trim()}\n\n` +
    `Top stories (summaries):\n${(stories.length ? stories : ['(none)']).map((s) => `- ${s}`).join('\n')}\n\n` +
    `Active focus items:\n${(focusTitles.length ? focusTitles : ['(none)']).map((t) => `- ${t}`).join('\n')}\n\n` +
    `Formatting rules: conversational paragraphs (no bullet lists, no numbered lists, no bold, no emoji). Each story gets its own paragraph (1-2 sentences). Use occasional parenthetical asides.\n` +
    `End with a punchy standalone tagline line, then a blank line, then the link on its own line, then hashtags at the end.\n` +
    `Use this exact link (standalone): ${link}\n` +
    `Hashtags: #cybersecurity plus 1-2 relevant hashtags.`

	const postText = await draftLinkedinWeeklyPostDirect({
		siteName: site.name,
		userPrompt,
		week_label: weekly.week_label,
		weekly_id: weekly.id
	})
  if (!postText) throw createError({ statusCode: 500, statusMessage: 'Anthropic response was empty' })

  const weekShort = weekly.week_label?.match(/W[0-9]+/i)?.[0] || weekly.week_label
  const subject = `Your ${weekShort} LinkedIn post is ready`

  const bodyText =
    'Copy the post text below into LinkedIn.\n' +
    'If you want a quote card image too, run:\n' +
    './scripts/linkedin/run_weekly_draft.sh /tmp/linkedin-draft\n\n' +
    '---\n\n' +
    postText.trim() +
    '\n'

  const html =
    '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">' +
    `<p><strong>${escapeHtml(subject)}</strong></p>` +
    '<p>Copy the post text below into LinkedIn.</p>' +
    '<p>If you want a quote card image too, run:<br><code>./scripts/linkedin/run_weekly_draft.sh /tmp/linkedin-draft</code></p>' +
    '<hr style="border:none;border-top:1px solid #e5e7eb;"/>' +
    `<pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.6;">${escapeHtml(postText.trim())}</pre>` +
    '</div>'

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
	    from: emailSenders.default(),
	    to: emailRecipients.linkedinDraft(),
    subject,
    html,
    text: bodyText
  })

  // Auto-post to X (fire and forget)
  try {
	  const siteUrl = site.url
    const tweet = formatWeeklyTweet({
      weekLabel: weekly.week_label || '',
      slug: weekly.slug || '',
      tldr: weekly.tldr || '',
      siteUrl
    })
    const result = await postTweet(tweet)
    if (result) console.log(`[cron/linkedin-draft] auto-tweeted: ${result.id}`)
  } catch (err) {
    console.warn('[cron/linkedin-draft] X auto-post failed:', err)
  }

  return { sent: true, week_label: weekly.week_label, slug: weekly.slug, forced: force }
})

