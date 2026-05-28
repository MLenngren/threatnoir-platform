import Anthropic from '@anthropic-ai/sdk'

import { logAiCall } from '../usage.js'
import { cleanArticleText } from '../utils/textClean.js'
import { CATEGORIES, STABLE_INSTRUCTIONS } from '../prompts/summarize-article.js'
import type { ClassifiedSummary } from '../types.js'

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey })
  return anthropicClient
}

const IOC_TYPES = [
  'ip',
  'domain',
  'hash_md5',
  'hash_sha1',
  'hash_sha256',
  'url',
  'cve',
  'mitre_attack',
  'email',
  'malware'
] as const

type IocType = (typeof IOC_TYPES)[number]
type IocItem = { type: IocType; value: string; context?: string }

export async function classifyAndSummarizeClaude(
  title: string,
  summary: string | null,
  fullText: string | null
): Promise<ClassifiedSummary> {
  const client = getAnthropicClient()
  const model = 'claude-haiku-4-5-20251001'

  // Variable per-call content (kept out of the cached system prompt prefix).
  const cleanedFullText = fullText ? cleanArticleText(fullText) : ''

  const startedAt = Date.now()
  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1000,
      system: [
        {
          type: 'text',
          text: STABLE_INSTRUCTIONS,
          // Prefer 1-hour TTL to avoid expiring mid-cron batch.
          cache_control: { type: 'ephemeral', ttl: '1h' }
        }
      ],
      messages: [
        {
          role: 'user',
          content:
            `Article title: ${title}\n` +
            `Article excerpt: ${summary?.trim() || 'No excerpt available'}` +
            (cleanedFullText ? `\n\nFull article text:\n${cleanedFullText}` : '') +
            `\n\nRespond with the JSON object described in the system prompt.`
        }
      ]
    })
  } catch (err) {
    await logAiCall({
      pipeline: 'article_summarize',
      model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: {
        title: title.slice(0, 200),
        hasSummary: Boolean(summary),
        hasFullText: Boolean(fullText)
      }
    })
    throw err
  }

  await logAiCall({
    pipeline: 'article_summarize',
    model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: {
      title: title.slice(0, 200),
      hasSummary: Boolean(summary),
      hasFullText: Boolean(fullText)
    }
  })

  const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  const parsed = JSON.parse(jsonMatch[0]) as {
    category?: string
    tags?: unknown
    brief?: string
    summary?: string
    jurisdiction?: unknown
    regulation?: unknown
    fine_amount?: unknown
    iocs?: unknown
    entities?: unknown
    relevance_score?: unknown
    podcast_dialogue?: unknown
  }
  const validSlugs = new Set<string>(CATEGORIES.map((c) => c.slug))
  const validIocTypes = new Set<string>(IOC_TYPES)
  const validEntityTypes = new Set(['product', 'vendor', 'threat_actor', 'campaign', 'technology'])

  const category = validSlugs.has(String(parsed.category))
    ? (parsed.category as ClassifiedSummary['category_slug'])
    : 'vulnerabilities'

  const tags = Array.isArray(parsed.tags) ? parsed.tags : []
  const normalizedTags = Array.from(
    new Set(
      tags
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t): t is string => !!t && validSlugs.has(t))
    )
  ).slice(0, 4)

  const aiSummary = (typeof parsed.summary === 'string' ? parsed.summary.trim() : '') || title

  const jurisdiction = typeof parsed.jurisdiction === 'string' ? parsed.jurisdiction.trim() || null : null
  const regulation = typeof parsed.regulation === 'string' ? parsed.regulation.trim() || null : null
  const fineAmount = typeof parsed.fine_amount === 'string' ? parsed.fine_amount.trim() || null : null

  const briefRaw = typeof parsed.brief === 'string' ? parsed.brief : ''
  let brief = briefRaw.replace(/\s+/g, ' ').trim()
  if (!brief) brief = title
  if (brief.length > 120) {
    let cut = brief.slice(0, 120)
    const lastSpace = cut.lastIndexOf(' ')
    // Avoid overly aggressive truncation; only trim back if it meaningfully improves readability.
    if (lastSpace >= 60) cut = cut.slice(0, lastSpace)
    brief = cut.trim()
  }

  const rawScore =
    typeof parsed.relevance_score === 'number'
      ? parsed.relevance_score
      : Number.parseInt(String(parsed.relevance_score ?? ''), 10)
  const relevanceScore = Number.isFinite(rawScore) ? Math.round(rawScore) : Number.NaN
  const relevance_score = relevanceScore >= 1 && relevanceScore <= 10 ? relevanceScore : 5

  const rawIocs = Array.isArray(parsed.iocs) ? parsed.iocs : []
  const normalizedIocs: IocItem[] = []
  const seen = new Set<string>()
  for (const item of rawIocs) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const typeRaw = typeof rec.type === 'string' ? rec.type.trim() : ''
    const valueRaw = typeof rec.value === 'string' ? rec.value.trim() : ''
    const contextRaw = typeof rec.context === 'string' ? rec.context.trim() : ''
    if (!typeRaw || !valueRaw) continue
    if (!validIocTypes.has(typeRaw)) continue
    const key = `${typeRaw}:${valueRaw}`
    if (seen.has(key)) continue
    seen.add(key)
    normalizedIocs.push({
      type: typeRaw as IocType,
      value: valueRaw.slice(0, 500),
      context: contextRaw ? contextRaw.slice(0, 500) : undefined
    })
    if (normalizedIocs.length >= 50) break
  }

  const rawEntities = Array.isArray(parsed.entities) ? parsed.entities : []
  const entities = rawEntities
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => {
      const type = typeof e.type === 'string' ? e.type.trim() : ''
      const name = typeof e.name === 'string' ? e.name.trim() : ''
      return { type, name }
    })
    .filter((e) => validEntityTypes.has(e.type) && e.name.length >= 2)
    .map((e) => ({ type: e.type, name: e.name.slice(0, 100) }))
    .slice(0, 6)

  const rawDialogue = Array.isArray(parsed.podcast_dialogue) ? parsed.podcast_dialogue : null
  let podcastDialogue: Array<{ speaker: string; text: string }> | undefined

  if (rawDialogue && rawDialogue.length >= 2) {
    const validSpeakers = new Set(['alex', 'marcus'])
    const lines: Array<{ speaker: string; text: string }> = []
    for (const line of rawDialogue) {
      if (!line || typeof line !== 'object') continue
      const rec = line as Record<string, unknown>
      const speaker = typeof rec.speaker === 'string' ? rec.speaker.trim().toLowerCase() : ''
      const textLine = typeof rec.text === 'string' ? rec.text.trim() : ''
      if (!validSpeakers.has(speaker) || !textLine) continue
      lines.push({ speaker, text: textLine.slice(0, 200) })
    }
    if (lines.length >= 2) {
      podcastDialogue = lines.slice(0, 8)
    }
  }

  return {
    category_slug: category,
    tags: normalizedTags,
    ai_summary: aiSummary,
    brief,
    jurisdiction,
    regulation,
    fine_amount: fineAmount,
    iocs: normalizedIocs,
    entities,
    relevance_score,
    podcast_dialogue: podcastDialogue
  }
}
