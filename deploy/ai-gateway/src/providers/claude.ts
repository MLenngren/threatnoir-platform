import Anthropic from '@anthropic-ai/sdk'

import { logAiCall } from '../usage.js'
import { cleanArticleText } from '../utils/textClean.js'
import { CATEGORIES, STABLE_INSTRUCTIONS } from '../prompts/summarize-article.js'
import { STABLE_INSTRUCTIONS as AWARENESS_INSTRUCTIONS } from '../prompts/generate-awareness.js'
import { STABLE_INSTRUCTIONS as RELEVANCE_INSTRUCTIONS } from '../prompts/rank-articles.js'
import { SHORTEN_INSTRUCTIONS, STABLE_INSTRUCTIONS as SOCIAL_DRAFT_INSTRUCTIONS } from '../prompts/draft-social-post.js'
import type {
  ClassifiedSummary,
  DraftSocialPostRequest,
  DraftSocialPostResponse,
  ExtractIocsResponse,
  GenerateAwarenessResponse
} from '../types.js'

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

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in response')
  return JSON.parse(m[0])
}

async function callClaude(params: {
  pipeline: string
  model: string
  maxTokens: number
  systemText?: string
  userText: string
  metadata?: Record<string, unknown>
}): Promise<Anthropic.Messages.Message> {
  const startedAt = Date.now()
  let response: Anthropic.Messages.Message | null = null

  try {
    const client = getAnthropicClient()
    const raw = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      ...(params.systemText
        ? {
            system: [
              {
                type: 'text',
                text: params.systemText,
                // Prefer 1-hour TTL to avoid expiring mid-cron batch.
                cache_control: { type: 'ephemeral', ttl: '1h' }
              }
            ]
          }
        : {}),
      messages: [{ role: 'user', content: params.userText }]
    })

    if (!raw || typeof raw !== 'object' || !('content' in raw)) {
      throw new Error('Unexpected streaming response from Anthropic client')
    }
    response = raw as Anthropic.Messages.Message
  } catch (err) {
    await logAiCall({
      pipeline: params.pipeline,
      model: params.model,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: params.metadata
    })
    throw err
  }

  await logAiCall({
    pipeline: params.pipeline,
    model: params.model,
    response,
    durationMs: Date.now() - startedAt,
    status: 'success',
    metadata: params.metadata
  })

  return response
}

async function classifyAndSummarizeInternal(
  pipeline: string,
  title: string,
  summary: string | null,
  fullText: string | null
): Promise<ClassifiedSummary> {
  const model = 'claude-haiku-4-5-20251001'

  // Variable per-call content (kept out of the cached system prompt prefix).
  const cleanedFullText = fullText ? cleanArticleText(fullText) : ''

  const response = await callClaude({
    pipeline,
    model,
    maxTokens: 1000,
    systemText: STABLE_INSTRUCTIONS,
    userText:
      `Article title: ${title}\n` +
      `Article excerpt: ${summary?.trim() || 'No excerpt available'}` +
      (cleanedFullText ? `\n\nFull article text:\n${cleanedFullText}` : '') +
      `\n\nRespond with the JSON object described in the system prompt.`,
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

export async function classifyAndSummarizeClaude(
  title: string,
  summary: string | null,
  fullText: string | null
): Promise<ClassifiedSummary> {
  return await classifyAndSummarizeInternal('article_summarize', title, summary, fullText)
}

export async function extractIocsClaude(
  title: string,
  summary: string | null,
  fullText: string | null
): Promise<ExtractIocsResponse> {
  const res = await classifyAndSummarizeInternal('iocs_extract', title, summary, fullText)
  return {
    iocs: res.iocs,
    entities: res.entities
  }
}

export async function generateAwarenessClaude(title: string, summary: string): Promise<GenerateAwarenessResponse> {
  const model = 'claude-sonnet-4-20250514'
  const response = await callClaude({
    pipeline: 'awareness_lesson',
    model,
    maxTokens: 900,
    systemText: AWARENESS_INSTRUCTIONS,
    userText: `Article title: ${title}\nArticle summary: ${summary}\n\nRespond with the JSON object described in the system prompt.`,
    metadata: {
      title: title.slice(0, 200)
    }
  })

  const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = extractJson(text) as Record<string, unknown>

  return {
    categories: Array.isArray(parsed.categories)
      ? parsed.categories.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 3)
      : [],
    title: typeof parsed.title === 'string' ? parsed.title : '',
    body: typeof parsed.body === 'string' ? parsed.body : '',
    prevention: typeof parsed.prevention === 'string' ? parsed.prevention : null,
    framework_refs: Array.isArray(parsed.framework_refs)
      ? parsed.framework_refs.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 20)
      : []
  }
}

export async function relevanceCheckClaude(text: string): Promise<boolean> {
  const model = 'claude-haiku-4-5-20251001'
  const response = await callClaude({
    pipeline: 'relevance_check',
    model,
    maxTokens: 10,
    systemText: RELEVANCE_INSTRUCTIONS,
    userText: `Text: "${(text || '').slice(0, 500)}"`,
    metadata: {
      text_len: (text || '').length
    }
  })

  const out = response.content?.[0]?.type === 'text' ? response.content[0].text.trim().toUpperCase() : 'YES'
  return out.startsWith('YES')
}

export async function draftSocialPostClaude(params: DraftSocialPostRequest): Promise<DraftSocialPostResponse> {
  const model = 'claude-haiku-4-5-20251001'

  const hooksBlock = params.hooks.map((h) => `- "${h}"`).join('\n')
  const recentHooksBlock = params.recentHooks.length
    ? params.recentHooks.map((h) => `"${h}"`).join(', ')
    : '(none)'

  const articlesForPrompt = params.articles.slice(0, 20).map((a) => ({
    id: String(a.id ?? ''),
    title: String(a.title ?? ''),
    summary: String(a.summary ?? '').slice(0, 500)
  }))

  const userPrompt =
    `You are ${params.siteName}'s social media writer. Pick the 3 most interesting and diverse stories from the provided articles and write social media posts.\n\n` +
    `Hook text to use (vary from previous posts): "${params.hookText}"\n` +
    `Do NOT use any of these recent hooks: ${recentHooksBlock}\n\n` +
    `Available hooks (pick one):\n${hooksBlock}\n\n` +
    `Available articles (choose exactly 3):\n${JSON.stringify(articlesForPrompt, null, 2)}\n\n` +
    `Link host to use: ${params.siteHost}`

  const response = await callClaude({
    pipeline: 'social_draft',
    model,
    maxTokens: 900,
    systemText: SOCIAL_DRAFT_INSTRUCTIONS,
    userText: userPrompt,
    metadata: {
      hook_text: params.hookText,
      candidate_count: params.articles.length
    }
  })

  const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = extractJson(text) as Record<string, unknown>

  const article_ids = Array.isArray(parsed.article_ids)
    ? parsed.article_ids.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
    : []

  let text_x = typeof parsed.text_x === 'string' ? parsed.text_x.trim() : ''
  const text_linkedin = typeof parsed.text_linkedin === 'string' ? parsed.text_linkedin.trim() : ''

  if (!text_x || !text_linkedin) {
    throw new Error('Model response missing text_x or text_linkedin')
  }

  if (text_x.length > 280) {
    const shortenUserPrompt = `Site host: ${params.siteHost}\n\nPost:\n${text_x}`

    const resp2 = await callClaude({
      pipeline: 'social_draft',
      model,
      maxTokens: 200,
      systemText: SHORTEN_INSTRUCTIONS,
      userText: shortenUserPrompt,
      metadata: {
        original_length: text_x.length
      }
    })

    const t2 = resp2.content?.[0]?.type === 'text' ? resp2.content[0].text : ''
    const p2 = extractJson(t2) as Record<string, unknown>
    const shortened = typeof p2.text_x === 'string' ? p2.text_x.trim() : ''
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
