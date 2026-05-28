import { createError, defineEventHandler, getHeader, getQuery } from 'h3'
import type { H3Event } from 'h3'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

import { checkAiQuota, logAiCall } from '../../utils/aiUsage'
import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { formatInsightTweet, postTweet } from '../../utils/twitter'

const LINKEDIN_VOICE_PROMPT =
  "When drafting LinkedIn posts for the weekly ThreatNoir roundup, match Marcus's actual posting style:\n\n" +
  '**Why:** Marcus posted the W14 roundup manually and the voice was much better than the AI-drafted numbered list. His style got engagement because it felt like a real person sharing, not a news bulletin.\n\n' +
  '**How to apply:**\n\nStructure:\n' +
  '- Open with personal commentary, not a cold hook. "I read that...", "Last week was...", a question or observation\n' +
  '- Flow as conversational paragraphs, NOT numbered lists\n' +
  '- Each story gets its own paragraph with 1-2 sentences\n' +
  '- Add parenthetical asides that show opinion: "(it does feel like Fortinet gets hit a lot?)", "(rougher than usual?)"\n' +
  '- End with the punchy tagline from the card\n' +
  '- Link at the bottom, standalone, not inline\n' +
  '- Hashtags at the very end: #cybersecurity + 1-2 topic-specific\n\nTone:\n' +
  '- Practitioner sharing with peers, not analyst briefing executives\n' +
  '- "I read that..." not "This week brought..."\n' +
  '- Personal takes: "not sure how long you would survive" not "organizations face significant risk"\n' +
  '- Slight provocations as questions, not statements\n' +
  '- No bold, no bullet points, no numbered lists\n' +
  '- No emoji\n\nReference post (W14):\n' +
  '"I read that last week was rough (rougher than usual?), if you are a business (big or small) good IT hygiene can be optional if you accept the risk, but not sure how long you would survive..."'

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

  if (!process.env.ANTHROPIC_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured' })
  }
  if (!process.env.RESEND_API_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'RESEND_API_KEY is not configured' })
  }

  const quota = await checkAiQuota()
  if (!quota.allowed) return { skipped: true, reason: quota.reason || 'AI quota exceeded' }

  const supabase = useSupabaseAdmin()
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

  const userPrompt = `Write a LinkedIn insight post about this security article. Share your personal take as a practitioner — what it means, why it matters, what teams should do.

Title: ${article.title}
Summary: ${article.ai_summary || ''}

End with the link standalone on its own line: https://threatnoir.com/article/${article.slug}
Add #cybersecurity and 1-2 relevant hashtags at the very end.

Keep it 150-200 words. Conversational paragraphs, not lists.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
	  const model = 'claude-haiku-4-5-20251001'
	  const startedAt = Date.now()
	  const resp = await client.messages.create({
	    model,
    max_tokens: 1000,
    temperature: 0.8,
    system: LINKEDIN_VOICE_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  })

	  await logAiCall({
	    pipeline: 'linkedin_draft_midweek',
	    model,
	    response: resp,
	    durationMs: Date.now() - startedAt,
	    metadata: {
	      article_id: article.id,
	      slug: article.slug
	    }
	  })

  const postText = (resp.content || [])
    .map((c) => (c.type === 'text' ? (c.text || '') : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
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
    from: 'ThreatNoir <noreply@threatnoir.com>',
    to: process.env.ADMIN_EMAIL || 'admin@example.com',
    subject,
    html,
    text: bodyText
  })

  // Auto-post to X (fire and forget)
  try {
    const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').replace(/\/$/, '')
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
