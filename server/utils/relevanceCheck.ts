import Anthropic from '@anthropic-ai/sdk'

import { checkAiQuota, logAiCall } from './aiUsage'

// NOTE: We now log actual token usage via logAiCall().

export async function isSecurityRelevant(tweetText: string): Promise<boolean> {
  // If AI disabled or quota exceeded, let everything through.
  const quota = await checkAiQuota()
  if (!quota.allowed) return true

  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/rank-articles`

    const timeoutMs = Number(process.env.AI_GATEWAY_TIMEOUT_MS) || 60_000
    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-gateway-token': token
        },
        body: JSON.stringify({ text: tweetText }),
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

    const data = (await res.json()) as { relevant?: unknown }
    return Boolean(data && typeof data === 'object' && (data as Record<string, unknown>).relevant)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return true // No API key, let through.

  try {
    const client = new Anthropic({ apiKey })
	  const model = 'claude-haiku-4-5-20251001'
	  const startedAt = Date.now()
	  const response = await client.messages.create({
	    model,
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content:
            `Is this tweet about a specific cybersecurity event, vulnerability, threat, tool release, data breach, malware campaign, or other actionable security intelligence? Not personal opinions, jokes, memes, job posts, or self-promotion.\n\n` +
            `Tweet: "${(tweetText || '').slice(0, 500)}"\n\n` +
            `Reply with ONLY "YES" or "NO".`
        }
      ]
    })

	  await logAiCall({
	    pipeline: 'tweet_relevance_check',
	    model,
	    response,
	    durationMs: Date.now() - startedAt,
	    metadata: {
	      tweet_len: (tweetText || '').length
	    }
	  })

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text.trim().toUpperCase() : 'YES'
    return text.startsWith('YES')
  } catch (err) {
    console.error('Relevance check failed:', err)
    return true // On error, let through.
  }
}
