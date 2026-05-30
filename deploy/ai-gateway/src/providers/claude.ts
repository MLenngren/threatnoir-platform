import Anthropic from '@anthropic-ai/sdk'

import { logAiCall } from '../usage.js'
import { computeCostMicroCents } from '../pricing.js'
import { cleanArticleText } from '../utils/textClean.js'
import { STABLE_INSTRUCTIONS } from '../prompts/summarize-article.js'
import { STABLE_INSTRUCTIONS as AWARENESS_INSTRUCTIONS } from '../prompts/generate-awareness.js'
import { STABLE_INSTRUCTIONS as RELEVANCE_INSTRUCTIONS } from '../prompts/rank-articles.js'
import { SHORTEN_INSTRUCTIONS, STABLE_INSTRUCTIONS as SOCIAL_DRAFT_INSTRUCTIONS } from '../prompts/draft-social-post.js'
import { buildLinkedinVoicePrompt } from '../prompts/linkedin-voice.js'
import { STABLE_SYSTEM as SHOW_SYSTEM, buildUserPrompt as buildShowUserPrompt } from '../prompts/summarize-show.js'
import { buildWeeklyRoundupPrompt } from '../prompts/weekly-roundup.js'
import { buildAutoFocusPrompt } from '../prompts/auto-focus.js'
import { buildLinkedinFocusUserPrompt } from '../prompts/draft-linkedin-focus.js'
import { buildFindRelatedPrompt } from '../prompts/find-related-articles.js'
import { buildLinkedinMidweekUserPrompt } from '../prompts/draft-linkedin-midweek.js'
import { CATEGORIES as RESOURCE_CATEGORIES, buildTagResourcePrompt } from '../prompts/tag-resource.js'
import type {
  ClassifiedSummary,
  DraftSocialPostRequest,
  DraftSocialPostResponse,
  ExtractIocsResponse,
  GenerateAwarenessResponse,
  AutoFocusTopicsRequest,
  AutoFocusTopicsResponse,
  DraftLinkedinFocusRequest,
  DraftLinkedinFocusResponse,
  DraftLinkedinMidweekRequest,
  DraftLinkedinMidweekResponse,
  DraftWeeklyRoundupRequest,
  DraftWeeklyRoundupResponse,
  FindRelatedArticlesRequest,
  FindRelatedArticlesResponse,
  SummarizeShowRequest,
  SummarizeShowResponse,
  TagResourceRequest,
  TagResourceResponse
} from '../types.js'

import type { Provider } from './types.js'

import { extractJson, parseClassifiedSummaryFromText } from './parsers.js'

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey })
  return anthropicClient
}

// JSON parsing helpers are shared across providers (Claude + Ollama).

async function callClaude(params: {
  pipeline: string
  model: string
  maxTokens: number
  systemText?: string
  userText: string
  temperature?: number
  metadata?: Record<string, unknown>
}): Promise<Anthropic.Messages.Message> {
  const startedAt = Date.now()
  let response: Anthropic.Messages.Message | null = null

  try {
    const client = getAnthropicClient()
    const raw = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      ...(typeof params.temperature === 'number' ? { temperature: params.temperature } : {}),
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

async function callClaudeWithImage(params: {
  pipeline: string
  model: string
  maxTokens: number
  systemText?: string
  temperature?: number
  userText: string
  image: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; base64: string }
  metadata?: Record<string, unknown>
}): Promise<Anthropic.Messages.Message> {
  const startedAt = Date.now()
  let response: Anthropic.Messages.Message | null = null

  try {
    const client = getAnthropicClient()
    const raw = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      ...(typeof params.temperature === 'number' ? { temperature: params.temperature } : {}),
      ...(params.systemText
        ? {
            system: [
              {
                type: 'text',
                text: params.systemText,
                cache_control: { type: 'ephemeral', ttl: '1h' }
              }
            ]
          }
        : {}),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: params.image.mediaType,
                data: params.image.base64
              }
            },
            { type: 'text', text: params.userText }
          ]
        }
      ]
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
  return parseClassifiedSummaryFromText({ title, text })
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

export async function summarizeShowClaude(req: SummarizeShowRequest): Promise<SummarizeShowResponse> {
  const title = (req.title || '').trim()
  const script = (req.script || '').trim()
  if (!title) throw new Error('title is required')
  if (!script) throw new Error('script is required')

  const model = 'claude-haiku-4-5-20251001'
  const userText = buildShowUserPrompt(title, script)
  const response = await callClaude({
    pipeline: 'video_briefing',
    model,
    maxTokens: 140,
    temperature: 0.2,
    systemText: SHOW_SYSTEM,
    userText,
    metadata: {
      title: title.slice(0, 200)
    }
  })

  const parts: string[] = []
  for (const block of response.content ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  const summary = parts.join('\n').trim()
  if (!summary) throw new Error('Empty model response')

  const costMicro = computeCostMicroCents(model, (response.usage ?? {}) as unknown as { input_tokens?: number; output_tokens?: number })
  const costCents = Number((costMicro / 10000).toFixed(1))

  return { summary, costCents }
}

export async function draftWeeklyRoundupClaude(req: DraftWeeklyRoundupRequest): Promise<DraftWeeklyRoundupResponse> {
  const siteName = (req.siteName || '').trim()
  const siteUrl = (req.siteUrl || '').trim()
  if (!siteName) throw new Error('siteName is required')
  if (!siteUrl) throw new Error('siteUrl is required')

  const prompt = buildWeeklyRoundupPrompt({ siteName, siteUrl, promptPayload: req.promptPayload })

  const model = 'claude-sonnet-4-20250514'
  const response = await callClaude({
    pipeline: 'weekly_roundup',
    model,
    maxTokens: 6000,
    userText: prompt,
    metadata: {
      week_label: String((req.promptPayload as Record<string, unknown>)?.week_label ?? '').slice(0, 32),
      slug: String((req.promptPayload as Record<string, unknown>)?.slug ?? '').slice(0, 80)
    }
  })

  const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = extractJson(text) as Record<string, unknown>

  const tldr = typeof parsed.tldr === 'string' ? parsed.tldr.trim() : ''
  const fullBrief = typeof parsed.full_brief === 'string' ? parsed.full_brief.trim() : ''
  if (!tldr || !fullBrief) throw new Error('Model response missing required fields (tldr/full_brief)')

  const executiveSummaryRaw = typeof parsed.executive_summary === 'string' ? parsed.executive_summary.trim() : ''
  const taglineRaw = typeof parsed.tagline === 'string' ? parsed.tagline.trim() : ''
  const socialLinkedIn = typeof parsed.social_linkedin === 'string' ? parsed.social_linkedin.trim() : ''
  const socialX = typeof parsed.social_x === 'string' ? parsed.social_x.trim() : ''

  return {
    tldr,
    full_brief: fullBrief,
    executive_summary: executiveSummaryRaw || null,
    tagline: taglineRaw || null,
    social_linkedin: socialLinkedIn || null,
    social_x: socialX || null
  }
}

export async function autoFocusTopicsClaude(req: AutoFocusTopicsRequest): Promise<AutoFocusTopicsResponse> {
  const title = (req.title || '').trim()
  const summary = (req.summary || '').trim()
  if (!title) throw new Error('title is required')
  if (!summary) throw new Error('summary is required')

  const model = 'claude-haiku-4-5-20251001'
  const prompt = buildAutoFocusPrompt({
    title,
    summary,
    cves: Array.isArray(req.cves) ? req.cves : [],
    relevance_score: Number(req.relevance_score ?? 0)
  })

  const response = await callClaude({
    pipeline: 'auto_focus',
    model,
    maxTokens: 400,
    userText: prompt,
    metadata: {
      title: title.slice(0, 200),
      relevance_score: Number(req.relevance_score ?? 0)
    }
  })

  try {
    const text = response.content?.[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = extractJson(text) as Record<string, unknown>
    const outSummary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
    const action = typeof parsed.action_required === 'string' ? parsed.action_required.trim() : ''
    const sev = typeof parsed.severity === 'string' ? parsed.severity.trim().toLowerCase() : 'high'
    if (!outSummary || !action) return null
    const validSev: 'critical' | 'high' | 'medium' =
      sev === 'critical' || sev === 'high' || sev === 'medium' ? (sev as 'critical' | 'high' | 'medium') : 'high'
    return { summary: outSummary, action_required: action, severity: validSev }
  } catch {
    return null
  }
}

export async function draftLinkedinFocusClaude(req: DraftLinkedinFocusRequest): Promise<DraftLinkedinFocusResponse> {
  const siteName = (req.siteName || '').trim()
  const siteUrl = (req.siteUrl || '').trim()
  if (!siteName) throw new Error('siteName is required')
  if (!siteUrl) throw new Error('siteUrl is required')

  const focus =
    req.focus ??
    ({
      id: '',
      title: '',
      summary: '',
      severity: ''
    } satisfies DraftLinkedinFocusRequest['focus'])
  const userText = buildLinkedinFocusUserPrompt(siteUrl, focus)

  const model = 'claude-haiku-4-5-20251001'
  const response = await callClaude({
    pipeline: 'linkedin_focus_draft',
    model,
    maxTokens: 500,
    temperature: 0.7,
    systemText: buildLinkedinVoicePrompt(siteName),
    userText,
    metadata: {
      focus_item_id: String(focus.id ?? '').slice(0, 80),
      severity: String(focus.severity ?? '').slice(0, 32)
    }
  })

  const text = (response.content || []).map((c) => (c.type === 'text' ? (c.text || '') : '')).join('\n').trim()
  if (!text) throw new Error('Anthropic response was empty')
  return { text }
}

export async function findRelatedArticlesClaude(req: FindRelatedArticlesRequest): Promise<FindRelatedArticlesResponse> {
  const prompt = buildFindRelatedPrompt(req)
  const model = 'claude-haiku-4-5-20251001'
  const response = await callClaude({
    pipeline: 'related_articles',
    model,
    maxTokens: 10,
    userText: prompt,
    metadata: {
      parent_title: (req.parentTitle || '').slice(0, 160),
      child_title: (req.childTitle || '').slice(0, 160)
    }
  })

  const text = (response.content || [])
    .map((c) => (c.type === 'text' ? c.text : ''))
    .join('\n')
    .trim()
    .toUpperCase()

  return { decision: text.startsWith('YES') }
}

export async function draftLinkedinMidweekClaude(req: DraftLinkedinMidweekRequest): Promise<DraftLinkedinMidweekResponse> {
  const siteName = (req.siteName || '').trim()
  const siteUrl = (req.siteUrl || '').trim()
  if (!siteName) throw new Error('siteName is required')
  if (!siteUrl) throw new Error('siteUrl is required')

  const userText = buildLinkedinMidweekUserPrompt(siteUrl, req.article)

  const model = 'claude-haiku-4-5-20251001'
  const response = await callClaude({
    pipeline: 'linkedin_midweek',
    model,
    maxTokens: 1000,
    temperature: 0.8,
    systemText: buildLinkedinVoicePrompt(siteName),
    userText,
    metadata: {
      article_id: String(req.article?.id ?? '').slice(0, 80),
      slug: String(req.article?.slug ?? '').slice(0, 80)
    }
  })

  const text = (response.content || []).map((c) => (c.type === 'text' ? (c.text || '') : '')).join('\n').trim()
  if (!text) throw new Error('Anthropic response was empty')
  return { text }
}

export async function tagResourceClaude(req: TagResourceRequest): Promise<TagResourceResponse> {
  const base64 = (req.base64 || '').trim()
  const mediaType = req.mediaType
  if (!base64) throw new Error('base64 is required')
  if (!mediaType) throw new Error('mediaType is required')
  if (!RESOURCE_CATEGORIES.length) throw new Error('No categories configured')

  const model = 'claude-haiku-4-5-20251001'
  const response = await callClaudeWithImage({
    pipeline: 'resource_tagger',
    model,
    maxTokens: 500,
    userText: buildTagResourcePrompt(RESOURCE_CATEGORIES),
    image: { mediaType, base64 },
    metadata: {
      media_type: mediaType
    }
  })

  const text = (response.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('').trim()
  const parsed = extractJson(text) as Record<string, unknown>

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
  const category = typeof parsed.category === 'string' ? parsed.category.trim() : ''
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean).slice(0, 8)
    : []

  return {
    title,
    description,
    category: RESOURCE_CATEGORIES.includes(category) ? category : '',
    tags
  }
}

export const claudeProvider: Provider = {
  classifyAndSummarize: classifyAndSummarizeClaude,
  extractIocs: extractIocsClaude,
  generateAwareness: generateAwarenessClaude,
  relevanceCheck: relevanceCheckClaude,
  draftSocialPost: draftSocialPostClaude,
  summarizeShow: summarizeShowClaude,
  draftWeeklyRoundup: draftWeeklyRoundupClaude,
  autoFocusTopics: autoFocusTopicsClaude,
  draftLinkedinFocus: draftLinkedinFocusClaude,
  findRelatedArticles: findRelatedArticlesClaude,
  draftLinkedinMidweek: draftLinkedinMidweekClaude,
  tagResource: tagResourceClaude
}
