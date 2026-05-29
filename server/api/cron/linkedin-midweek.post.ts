import { createError, defineEventHandler, getHeader, getQuery } from 'h3'
import type { H3Event } from 'h3'
import { Resend } from 'resend'

import { checkAiQuota } from '../../utils/aiUsage'
import { emailRecipients, emailSenders } from '../../utils/emailConfig'
import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { formatInsightTweet, postTweet } from '../../utils/twitter'
import { getSiteConfig } from '../../utils/siteConfig'
import { draftLinkedinMidweekPostText } from '../../utils/linkedinMidweekDrafter'

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

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const q = getQuery<{ force?: string }>(event)
  const force = String(q.force || '').toLowerCase() === 'true'
  const now = new Date()
  const isWednesday = now.getUTCDay() === 3
  if (!isWednesday && !force) {
    return { skipped: true, reason: 'not Wednesday' }
  }

	const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
	const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
	if (!gatewayUrl && !apiKey) {
		throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured (and AI_GATEWAY_URL is unset)' })
	}
	if (gatewayUrl && !process.env.AI_GATEWAY_INTERNAL_TOKEN?.trim()) {
		throw createError({ statusCode: 500, statusMessage: 'AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set' })
	}
  if (!process.env.RESEND_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'RESEND_API_KEY is not configured' })
  }

  const quota = await checkAiQuota()
  if (!quota.allowed) return { skipped: true, reason: quota.reason || 'AI quota exceeded' }

  const supabase = useSupabaseAdmin()
	const site = getSiteConfig()
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id,title,slug,ai_summary,url,relevance_score,published_at')
    .eq('status', 'approved')
    .gte('published_at', cutoff)
    .order('relevance_score', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[cron/linkedin-midweek] DB error (articles):', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  type ArticleRow = {
    id: string
    title: string
    slug: string
    ai_summary: string | null
    url: string
    relevance_score: number | null
    published_at: string | null
  }

  const article = (articles?.[0] as ArticleRow | undefined) || undefined
  if (!article) {
    return { skipped: true, reason: 'no recent articles found' }
  }

	const postText = await draftLinkedinMidweekPostText({
		siteName: site.name,
		siteUrl: site.url,
		article: {
			id: article.id,
			title: article.title,
			slug: article.slug,
			ai_summary: article.ai_summary
		}
	})
  if (!postText) throw createError({ statusCode: 500, statusMessage: 'Anthropic response was empty' })

  const subject = `Your midweek LinkedIn post is ready — ${article.title.slice(0, 60)}`

  const bodyText = 'Copy the post text below into LinkedIn.\n\n---\n\n' + postText.trim() + '\n'

  const html =
    '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">' +
    `<p><strong>${escapeHtml(subject)}</strong></p>` +
    '<p>Copy the post text below into LinkedIn.</p>' +
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
    const tweet = formatInsightTweet({
      title: article.title || '',
      slug: article.slug || '',
      siteUrl
    })
    const result = await postTweet(tweet)
    if (result) console.log(`[cron/linkedin-midweek] auto-tweeted: ${result.id}`)
  } catch (err) {
    console.warn('[cron/linkedin-midweek] X auto-post failed:', err)
  }

  return { sent: true, id: article.id, slug: article.slug, forced: force }
})
