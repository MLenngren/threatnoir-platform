import { tagResourceDirect } from './anthropic'

export type ResourceAiSuggestion = {
  title: string
  description: string
  category: string
  tags: string[]
}

type MediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

export async function tagResourceImage(params: {
  mediaType: MediaType
  base64: string
}): Promise<ResourceAiSuggestion | null> {
  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/tag-resource`
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
          mediaType: params.mediaType,
          base64: params.base64
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
    if (!data) return null
    return {
      title: typeof data.title === 'string' ? data.title.trim() : '',
      description: typeof data.description === 'string' ? data.description.trim() : '',
      category: typeof data.category === 'string' ? data.category.trim() : '',
      tags: Array.isArray(data.tags) ? data.tags.filter((t: unknown) => typeof t === 'string') : []
    }
  }

  return await tagResourceDirect({ mediaType: params.mediaType, base64: params.base64 })
}
