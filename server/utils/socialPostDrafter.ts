import Anthropic from '@anthropic-ai/sdk'

import { logAiCall } from './aiUsage'

export type SocialPostDraftArticle = {
  id: string
  title: string
  summary: string
}

export type DraftSocialPostParams = {
  hookText: string
  recentHooks: string[]
  hooks: readonly string[]
  siteName: string
  siteHost: string
  articles: SocialPostDraftArticle[]
  // For backward-compatible logging: original cron logged candidate_count as the
  // full candidate list length, not just the prompt-truncated list.
  candidateCount?: number
}

export type DraftSocialPostResult = {
  article_ids: string[]
  text_x: string
  text_linkedin: string
}

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in response')
  return JSON.parse(m[0])
}

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function draftSocialPost(params: DraftSocialPostParams): Promise<DraftSocialPostResult> {
  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/draft-social-post`
    const timeoutMs = Number(process.env.AI_GATEWAY_TIMEOUT_MS) || 60_000

    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-gateway-token': token
        },
        body: JSON.stringify({
          hookText: params.hookText,
          recentHooks: params.recentHooks,
          hooks: [...params.hooks],
          siteName: params.siteName,
          siteHost: params.siteHost,
          articles: params.articles
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
      throw new Error(
        `[ai-gateway] ${isTimeout ? `timeout after ${timeoutMs}ms` : 'network error'} calling ${url}: ${msg}`
      )
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`[ai-gateway] ${res.status} calling ${url}: ` + (body ? body.slice(0, 800) : res.statusText))
    }

    return (await res.json()) as DraftSocialPostResult
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

  const client = new Anthropic({ apiKey })

  const articlesForPrompt = params.articles.slice(0, 20).map((a) => ({
    id: a.id,
    title: a.title,
    summary: (a.summary || '').slice(0, 500)
  }))

  const prompt = `You are ${params.siteName}'s social media writer. Pick the 3 most interesting and diverse stories from the provided articles and write social media posts.

Rules:
- Practitioner voice, not marketing. Direct and useful.
- No em dashes anywhere. Use periods, colons, or pipes instead.
- Each story gets a one-line summary with the "so what" angle.
	- Link to ${params.siteHost} (not individual article URLs).
- Max 3-4 hashtags: #cybersecurity #threatintel and 1-2 topic-specific ones.
- Pick diverse stories. Avoid 3 of the same category.

Return ONLY valid JSON:
{
  "article_ids": ["uuid1", "uuid2", "uuid3"],
  "text_x": "<X/Twitter version, MUST be under 280 characters including link and hashtags>",
  "text_linkedin": "<LinkedIn version, longer format with bold titles and context>"
}

Hook text to use (vary from previous posts): "${params.hookText}"
Do NOT use any of these recent hooks: ${params.recentHooks.length ? params.recentHooks.map((h) => `"${h}"`).join(', ') : '(none)'}

Available hooks (pick one):
${params.hooks.map((h) => `- "${h}"`).join('\n')}

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
      hook_text: params.hookText,
      candidate_count: Number.isFinite(params.candidateCount ?? NaN) ? (params.candidateCount as number) : params.articles.length
    }
  })

  const text = resp.content?.[0]?.type === 'text' ? resp.content[0].text : ''
  const parsed = extractJson(text) as Record<string, unknown>

  const rawIds = Array.isArray(parsed.article_ids) ? parsed.article_ids : []
  const article_ids = rawIds.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)

  let text_x = normalizeString(parsed.text_x)
  const text_linkedin = normalizeString(parsed.text_linkedin)

  if (!text_x || !text_linkedin) {
    throw new Error('Model response missing text_x or text_linkedin')
  }

  // Hard enforcement: ensure X text fits.
  if (text_x.length > 280) {
    const shortenPrompt = `Shorten this X post to be under 280 characters total.
Rules:
- Keep the same 3 numbered items.
	- Keep the final line with "${params.siteHost}".
- Keep 2-4 hashtags.
- No em dashes.

Return ONLY valid JSON: { "text_x": "..." }

Post:
${text_x}`

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
        original_length: text_x.length
      }
    })
    const t2 = resp2.content?.[0]?.type === 'text' ? resp2.content[0].text : ''
    const p2 = extractJson(t2) as Record<string, unknown>
    const shortened = normalizeString(p2.text_x)
    if (shortened && shortened.length <= 280) text_x = shortened
  }

  if (text_x.length > 280) {
    throw new Error(`Generated X text exceeds 280 chars (${text_x.length})`)
  }

  return {
    article_ids: article_ids.slice(0, 3),
    text_x,
    text_linkedin
  }
}
