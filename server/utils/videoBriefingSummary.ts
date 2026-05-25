import { getAnthropicClient } from './anthropic'
import { logAiCall } from './aiUsage'
import { computeCostMicroCents } from './aiPricing'
import { errorMessage, isPermanentError, isTransientError, sleep } from './llmRetry'

const MODEL = 'claude-haiku-4-5-20251001'

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

  const client = getAnthropicClient()

  const system = [
    'Write a concise episode description for a security news video briefing.',
    '',
    'Output exactly TWO short sentences. Each sentence must be under 130 characters. Combined output must be under 260 characters.',
    '',
    'Sentence 1: state what happened (the incident, vulnerability, or event in one complete clause).',
    'Sentence 2: state why it matters to a security practitioner (the takeaway, consequence, or systemic issue).',
    '',
    'Output plain text only. No markdown, no quotes, no Unicode bullets, no "In today\'s episode..." or "This episode covers..." framing. Practitioner tone: neutral, factual, no hype.',
    '',
    'End each sentence with a period, exclamation mark, or question mark.'
  ].join('\n')

  const user = `Title: ${titleText}\n\nScript:\n${scriptText.slice(0, 12000)}`

  let lastErr: unknown
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
	    const startedAt = Date.now()
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 140,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: user }]
      })

	    await logAiCall({
	      pipeline: 'video_briefing_summary',
	      model: MODEL,
	      response: resp,
	      durationMs: Date.now() - startedAt,
	      metadata: {
	        title: titleText.slice(0, 200)
	      }
	    })

      const parts: string[] = []
      for (const block of resp.content ?? []) {
        if (block?.type === 'text' && typeof block.text === 'string') {
          parts.push(block.text)
        }
      }
      const raw = parts.join('\n').trim()
      if (!raw) throw new Error('Empty model response')

      const summary = sanitizeSummary(raw)

	    const costMicro = computeCostMicroCents(MODEL, resp.usage ?? {})
      return {
        summary,
	      costCents: Number((costMicro / 10000).toFixed(1))
      }
    } catch (err) {
      lastErr = err
      if (isPermanentError(err) || !isTransientError(err) || attempt >= 5) {
        throw err
      }

      const backoffMs = Math.min(8000, 500 * 2 ** (attempt - 1))
      const jitterMs = Math.floor(Math.random() * 200)
      await sleep(backoffMs + jitterMs)
    }
  }

  // Should be unreachable.
  throw lastErr instanceof Error ? lastErr : new Error(errorMessage(lastErr))
}
