import { summarizeShowDirect } from './anthropic'

function sanitizeSummary(raw: string): string {
  let s = (raw || '').trim()

  // Remove code fences and common markdown wrappers.
  s = s.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '')
  s = s.replace(/^>\s+/gm, '')
  s = s.replace(/[*_`#]/g, '')

  // Strip unicode bullets anywhere.
  s = s.replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25CF]/g, '')

  // Collapse whitespace / newlines.
  s = s.replace(/\s+/g, ' ').trim()

  // Strip surrounding quotes.
  s = s.replace(/^["'“”]+/, '').replace(/["'“”]+$/, '').trim()

  // Clamp to a complete sentence boundary (keeps OG summaries from truncating mid-sentence).
  s = clampToSentence(s, 280)

  // If the model fails to punctuate, make the result read like a complete sentence.
  s = enforcePeriod(s)

  return s
}

function clampToSentence(s: string, max: number): string {
  if (s.length <= max) return s

  const slice = s.slice(0, max)
  const minAcceptable = Math.floor(max * 0.6)
  const terminators = ['. ', '! ', '? ', '.\n', '!\n', '?\n']

  let bestIdx = -1
  for (const t of terminators) {
    const idx = slice.lastIndexOf(t)
    if (idx > bestIdx) bestIdx = idx
  }

  if (bestIdx >= minAcceptable) {
    // Include the terminator character but drop the trailing space/newline
    return slice.slice(0, bestIdx + 1).trim()
  }

  // No sentence boundary found in acceptable range — cut at last word, drop trailing punctuation, re-add period
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace >= minAcceptable) {
    return slice.slice(0, lastSpace).replace(/[,;:]$/, '') + '.'
  }

  // Degenerate: fall back to hard cut (shouldn't happen with tightened prompt)
  return slice.replace(/[,;:]\s*$/, '') + '.'
}

function enforcePeriod(s: string): string {
  const t = (s || '').trim()
  if (!t) return t
  if (/[.!?]$/.test(t)) return t
  return t + '.'
}

export async function summarizeVideoBriefing(
  script: string,
  title: string
): Promise<{
  summary: string
  costCents: number
}> {
  const scriptText = (script || '').trim()
  const titleText = (title || '').trim()

  if (!scriptText) throw new Error('Missing script')
  if (!titleText) throw new Error('Missing title')


  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  if (gatewayUrl) {
    const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
    if (!token || !token.trim()) {
      throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
    }

    const base = gatewayUrl.replace(/\/+$/, '')
    const url = `${base}/summarize-show`

    const timeoutMs = Number(process.env.AI_GATEWAY_TIMEOUT_MS) || 60_000
    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-gateway-token': token
        },
        body: JSON.stringify({ title: titleText, script: scriptText }),
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
			const e = new Error(
				`[ai-gateway] ${res.status} calling ${url}: ` + (body ? body.slice(0, 800) : res.statusText)
			) as Error & { status?: number }
			e.status = res.status
			throw e
    }

    const data = (await res.json().catch(() => null)) as { summary?: unknown; costCents?: unknown } | null
    const raw = typeof data?.summary === 'string' ? data.summary : ''
    const costCents = typeof data?.costCents === 'number' ? data.costCents : Number(data?.costCents ?? 0)
    if (!raw) throw new Error('Empty model response')

    return {
      summary: sanitizeSummary(raw),
      costCents: Number.isFinite(costCents) ? costCents : 0
    }
  }

  const direct = await summarizeShowDirect({ title: titleText, script: scriptText })
  return {
    summary: sanitizeSummary(direct.summary),
    costCents: direct.costCents
  }
}
