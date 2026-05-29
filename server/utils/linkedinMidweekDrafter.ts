import { draftLinkedinMidweekDirect } from './anthropic'

type MidweekArticle = {
  id: string
  title: string
  slug: string
  ai_summary: string | null
}

export async function draftLinkedinMidweekPostText(params: {
  siteName: string
  siteUrl: string
  article: MidweekArticle
}): Promise<string> {
  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/draft-linkedin-midweek`
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
          siteName: params.siteName,
          siteUrl: params.siteUrl,
          article: params.article
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

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return typeof data?.text === 'string' ? data.text.trim() : ''
  }

  return (await draftLinkedinMidweekDirect({
    siteName: params.siteName,
    siteUrl: params.siteUrl,
    article: params.article
  })).trim()
}
