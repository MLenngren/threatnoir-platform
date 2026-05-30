import { logAiCall } from '../usage.js'
import { cleanArticleText } from '../utils/textClean.js'
import { STABLE_INSTRUCTIONS as ARTICLE_SYSTEM } from '../prompts/summarize-article.js'
import { STABLE_INSTRUCTIONS as AWARENESS_SYSTEM } from '../prompts/generate-awareness.js'
import { STABLE_INSTRUCTIONS as RELEVANCE_SYSTEM } from '../prompts/rank-articles.js'
import { SHORTEN_INSTRUCTIONS, STABLE_INSTRUCTIONS as SOCIAL_SYSTEM } from '../prompts/draft-social-post.js'
import { buildLinkedinVoicePrompt } from '../prompts/linkedin-voice.js'
import { STABLE_SYSTEM as SHOW_SYSTEM, buildUserPrompt as buildShowUserPrompt } from '../prompts/summarize-show.js'
import { buildWeeklyRoundupPrompt } from '../prompts/weekly-roundup.js'
import { buildAutoFocusPrompt } from '../prompts/auto-focus.js'
import { buildLinkedinFocusUserPrompt } from '../prompts/draft-linkedin-focus.js'
import { buildFindRelatedPrompt } from '../prompts/find-related-articles.js'
import { buildLinkedinMidweekUserPrompt } from '../prompts/draft-linkedin-midweek.js'
import { CATEGORIES as RESOURCE_CATEGORIES, buildTagResourcePrompt } from '../prompts/tag-resource.js'
import type {
  AutoFocusTopicsRequest,
  AutoFocusTopicsResponse,
  ClassifiedSummary,
  DraftLinkedinFocusRequest,
  DraftLinkedinFocusResponse,
  DraftLinkedinMidweekRequest,
  DraftLinkedinMidweekResponse,
  DraftSocialPostRequest,
  DraftSocialPostResponse,
  DraftWeeklyRoundupRequest,
  DraftWeeklyRoundupResponse,
  ExtractIocsResponse,
  FindRelatedArticlesRequest,
  FindRelatedArticlesResponse,
  GenerateAwarenessResponse,
  SummarizeShowRequest,
  SummarizeShowResponse,
  TagResourceRequest,
  TagResourceResponse
} from '../types.js'

import type { Provider } from './types.js'

import { extractJson, parseClassifiedSummaryFromText } from './parsers.js'

type OpenRouterChatCompletionResponse = {
  id?: string
  choices?: Array<{ message?: { content?: string } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    // OpenRouter extension (USD)
    total_cost?: number
  }
  error?: { message?: string; code?: string }
}

function normalizeBaseUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

function getOpenRouterBaseUrl(): string {
  // OpenRouter is OpenAI-compatible under /v1.
  return normalizeBaseUrl(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api')
}

function getOpenRouterApiKey(): string {
  // Allow blank to exercise the request path (expected 401 from OpenRouter).
  return (process.env.OPENROUTER_API_KEY || '').trim()
}

function getOpenRouterModel(): string {
  return (process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku').trim() || 'anthropic/claude-3.5-haiku'
}

function getOpenRouterHeaders(): Record<string, string> {
  const apiKey = getOpenRouterApiKey()
  const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:7000').trim() || 'http://localhost:7000'
  const siteName = (process.env.NUXT_PUBLIC_SITE_NAME || process.env.NUXT_PUBLIC_SITE_TITLE || 'ThreatNoir').trim() || 'ThreatNoir'

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    // OpenRouter recommendations for attribution:
    // https://openrouter.ai/docs#attribution
    'http-referer': siteUrl,
    'x-title': siteName
  }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  return headers
}

async function openrouterChat(params: {
  pipeline: string
  systemText?: string
  userText: string
  maxTokens?: number
  temperature?: number
  responseFormatJson?: boolean
  image?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; base64: string }
  metadata?: Record<string, unknown>
}): Promise<{ text: string; modelKey: string; costMicroCents: number; durationMs: number }>
{
  const startedAt = Date.now()
  const baseUrl = getOpenRouterBaseUrl()
  const model = getOpenRouterModel()
  const modelKey = `openrouter:${model}`

  const messages: Array<Record<string, unknown>> = []
  if (params.systemText) messages.push({ role: 'system', content: params.systemText })

  if (params.image) {
    const dataUrl = `data:${params.image.mediaType};base64,${params.image.base64}`
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: params.userText }
      ]
    })
  } else {
    messages.push({ role: 'user', content: params.userText })
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false
  }
  if (typeof params.maxTokens === 'number') body.max_tokens = params.maxTokens
  if (typeof params.temperature === 'number') body.temperature = params.temperature
  if (params.responseFormatJson) body.response_format = { type: 'json_object' }

  let data: OpenRouterChatCompletionResponse | null = null
  let status: number | null = null
  let errText: string | null = null

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: getOpenRouterHeaders(),
      body: JSON.stringify(body)
    })

    status = res.status
    if (!res.ok) {
      errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter error ${res.status}: ${String(errText || '').slice(0, 300)}`)
    }

    data = (await res.json()) as OpenRouterChatCompletionResponse
  } catch (err) {
    await logAiCall({
      pipeline: params.pipeline,
      model: modelKey,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: {
        provider: 'openrouter',
        base_url: baseUrl,
        http_status: status,
        error_body: errText ? errText.slice(0, 300) : null,
        ...(params.metadata ?? {})
      }
    })

    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[openrouter] failed calling ${baseUrl}/v1/chat/completions: ${msg}`, { cause: err as unknown })
  }

  const durationMs = Date.now() - startedAt
  const promptTokens = Math.max(0, Math.round(data?.usage?.prompt_tokens ?? 0))
  const completionTokens = Math.max(0, Math.round(data?.usage?.completion_tokens ?? 0))
  const totalCostUsd = Number(data?.usage?.total_cost ?? 0)
  const costMicroCents = Number.isFinite(totalCostUsd) ? Math.max(0, Math.round(totalCostUsd * 1_000_000)) : 0

  await logAiCall({
    pipeline: params.pipeline,
    model: modelKey,
    response: {
      usage: {
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0
      }
    },
    durationMs,
    status: 'success',
    metadata: {
      provider: 'openrouter',
      base_url: baseUrl,
      openrouter_id: typeof data?.id === 'string' ? data.id : null,
      ...(params.metadata ?? {})
    },
    costMicroCentsOverride: costMicroCents
  })

  const text = (data?.choices?.[0]?.message?.content || '').trim()
  return { text, modelKey, costMicroCents, durationMs }
}

function buildSummarizeArticleUserText(title: string, summary: string | null, fullText: string | null): string {
  const cleanedFullText = fullText ? cleanArticleText(fullText) : ''
  return (
    `Article title: ${title}\n` +
    `Article excerpt: ${summary?.trim() || 'No excerpt available'}` +
    (cleanedFullText ? `\n\nFull article text:\n${cleanedFullText}` : '') +
    `\n\nRespond with the JSON object described in the system prompt.`
  )
}

function buildGenerateAwarenessUserText(title: string, summary: string): string {
  return `Article title: ${title}\nArticle summary: ${summary}\n\nRespond with the JSON object described in the system prompt.`
}

function buildRelevanceUserText(text: string): string {
  return `Text: "${(text || '').slice(0, 500)}"`
}

function buildDraftSocialUserText(params: DraftSocialPostRequest): string {
  const hooksBlock = params.hooks.map((h) => `- "${h}"`).join('\n')
  const recentHooksBlock = params.recentHooks.length ? params.recentHooks.map((h) => `"${h}"`).join(', ') : '(none)'

  const articlesForPrompt = params.articles.slice(0, 20).map((a) => ({
    id: String(a.id ?? ''),
    title: String(a.title ?? ''),
    summary: String(a.summary ?? '').slice(0, 500)
  }))

  return (
    `You are ${params.siteName}'s social media writer. Pick the 3 most interesting and diverse stories from the provided articles and write social media posts.\n\n` +
    `Hook text to use (vary from previous posts): "${params.hookText}"\n` +
    `Do NOT use any of these recent hooks: ${recentHooksBlock}\n\n` +
    `Available hooks (pick one):\n${hooksBlock}\n\n` +
    `Available articles (choose exactly 3):\n${JSON.stringify(articlesForPrompt, null, 2)}\n\n` +
    `Link host to use: ${params.siteHost}`
  )
}

export const openrouterProvider: Provider = {
  async classifyAndSummarize(title: string, summary: string | null, fullText: string | null): Promise<ClassifiedSummary> {
    const res = await openrouterChat({
      pipeline: 'article_summarize',
      systemText: ARTICLE_SYSTEM,
      userText: buildSummarizeArticleUserText(title, summary, fullText),
      maxTokens: 1000,
      responseFormatJson: true,
      metadata: {
        title: title.slice(0, 200),
        hasSummary: Boolean(summary),
        hasFullText: Boolean(fullText)
      }
    })

    return parseClassifiedSummaryFromText({ title, text: res.text })
  },

  async extractIocs(title: string, summary: string | null, fullText: string | null): Promise<ExtractIocsResponse> {
    const res = await openrouterChat({
      pipeline: 'iocs_extract',
      systemText: ARTICLE_SYSTEM,
      userText: buildSummarizeArticleUserText(title, summary, fullText),
      maxTokens: 1000,
      responseFormatJson: true,
      metadata: {
        title: title.slice(0, 200),
        hasSummary: Boolean(summary),
        hasFullText: Boolean(fullText)
      }
    })

    const parsed = parseClassifiedSummaryFromText({ title, text: res.text })
    return { iocs: parsed.iocs, entities: parsed.entities }
  },

  async generateAwareness(title: string, summary: string): Promise<GenerateAwarenessResponse> {
    const res = await openrouterChat({
      pipeline: 'awareness_lesson',
      systemText: AWARENESS_SYSTEM,
      userText: buildGenerateAwarenessUserText(title, summary),
      maxTokens: 900,
      responseFormatJson: true,
      metadata: {
        title: title.slice(0, 200)
      }
    })

    const parsed = extractJson(res.text) as Record<string, unknown>

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
  },

  async relevanceCheck(text: string): Promise<boolean> {
    const res = await openrouterChat({
      pipeline: 'relevance_check',
      systemText: RELEVANCE_SYSTEM,
      userText: buildRelevanceUserText(text),
      maxTokens: 10,
      metadata: {
        text_len: (text || '').length
      }
    })

    const out = (res.text || '').trim().toUpperCase()
    return out.startsWith('YES')
  },

  async draftSocialPost(params: DraftSocialPostRequest): Promise<DraftSocialPostResponse> {
    const res = await openrouterChat({
      pipeline: 'social_draft',
      systemText: SOCIAL_SYSTEM,
      userText: buildDraftSocialUserText(params),
      maxTokens: 900,
      responseFormatJson: true,
      metadata: {
        hook_text: params.hookText,
        candidate_count: params.articles.length
      }
    })

    const parsed = extractJson(res.text) as Record<string, unknown>

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
      const res2 = await openrouterChat({
        pipeline: 'social_draft',
        systemText: SHORTEN_INSTRUCTIONS,
        userText: shortenUserPrompt,
        maxTokens: 200,
        responseFormatJson: true,
        metadata: {
          original_length: text_x.length
        }
      })

      const p2 = extractJson(res2.text) as Record<string, unknown>
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
  },

  async summarizeShow(req: SummarizeShowRequest): Promise<SummarizeShowResponse> {
    const title = (req.title || '').trim()
    const script = (req.script || '').trim()
    if (!title) throw new Error('title is required')
    if (!script) throw new Error('script is required')

    const res = await openrouterChat({
      pipeline: 'video_briefing',
      systemText: SHOW_SYSTEM,
      userText: buildShowUserPrompt(title, script),
      maxTokens: 140,
      temperature: 0.2,
      metadata: {
        title: title.slice(0, 200)
      }
    })

    const summary = (res.text || '').trim()
    if (!summary) throw new Error('Empty model response')

    const costCents = Number((res.costMicroCents / 10000).toFixed(1))
    return { summary, costCents }
  },

  async draftWeeklyRoundup(req: DraftWeeklyRoundupRequest): Promise<DraftWeeklyRoundupResponse> {
    const siteName = (req.siteName || '').trim()
    const siteUrl = (req.siteUrl || '').trim()
    if (!siteName) throw new Error('siteName is required')
    if (!siteUrl) throw new Error('siteUrl is required')

    const prompt = buildWeeklyRoundupPrompt({ siteName, siteUrl, promptPayload: req.promptPayload })
    const res = await openrouterChat({
      pipeline: 'weekly_roundup',
      userText: prompt,
      maxTokens: 6000,
      responseFormatJson: true,
      metadata: {
        week_label: String((req.promptPayload as Record<string, unknown>)?.week_label ?? '').slice(0, 32),
        slug: String((req.promptPayload as Record<string, unknown>)?.slug ?? '').slice(0, 80)
      }
    })

    const parsed = extractJson(res.text) as Record<string, unknown>

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
  },

  async autoFocusTopics(req: AutoFocusTopicsRequest): Promise<AutoFocusTopicsResponse> {
    const title = (req.title || '').trim()
    const summary = (req.summary || '').trim()
    if (!title) throw new Error('title is required')
    if (!summary) throw new Error('summary is required')

    const prompt = buildAutoFocusPrompt({
      title,
      summary,
      cves: Array.isArray(req.cves) ? req.cves : [],
      relevance_score: Number(req.relevance_score ?? 0)
    })

    const res = await openrouterChat({
      pipeline: 'auto_focus',
      userText: prompt,
      maxTokens: 400,
      responseFormatJson: true,
      metadata: {
        title: title.slice(0, 200),
        relevance_score: Number(req.relevance_score ?? 0)
      }
    })

    try {
      const parsed = extractJson(res.text) as Record<string, unknown>
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
  },

  async draftLinkedinFocus(req: DraftLinkedinFocusRequest): Promise<DraftLinkedinFocusResponse> {
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

    const res = await openrouterChat({
      pipeline: 'linkedin_focus_draft',
      systemText: buildLinkedinVoicePrompt(siteName),
      userText: buildLinkedinFocusUserPrompt(siteUrl, focus),
      maxTokens: 500,
      temperature: 0.7,
      metadata: {
        focus_item_id: String(focus.id ?? '').slice(0, 80),
        severity: String(focus.severity ?? '').slice(0, 32)
      }
    })

    const text = (res.text || '').trim()
    if (!text) throw new Error('Model response was empty')
    return { text }
  },

  async findRelatedArticles(req: FindRelatedArticlesRequest): Promise<FindRelatedArticlesResponse> {
    const res = await openrouterChat({
      pipeline: 'related_articles',
      userText: buildFindRelatedPrompt(req),
      maxTokens: 10,
      metadata: {
        parent_title: (req.parentTitle || '').slice(0, 160),
        child_title: (req.childTitle || '').slice(0, 160)
      }
    })

    const text = (res.text || '').trim().toUpperCase()
    return { decision: text.startsWith('YES') }
  },

  async draftLinkedinMidweek(req: DraftLinkedinMidweekRequest): Promise<DraftLinkedinMidweekResponse> {
    const siteName = (req.siteName || '').trim()
    const siteUrl = (req.siteUrl || '').trim()
    if (!siteName) throw new Error('siteName is required')
    if (!siteUrl) throw new Error('siteUrl is required')

    const res = await openrouterChat({
      pipeline: 'linkedin_midweek',
      systemText: buildLinkedinVoicePrompt(siteName),
      userText: buildLinkedinMidweekUserPrompt(siteUrl, req.article),
      maxTokens: 1000,
      temperature: 0.8,
      metadata: {
        article_id: String(req.article?.id ?? '').slice(0, 80),
        slug: String(req.article?.slug ?? '').slice(0, 80)
      }
    })

    const text = (res.text || '').trim()
    if (!text) throw new Error('Model response was empty')
    return { text }
  },

  async tagResource(req: TagResourceRequest): Promise<TagResourceResponse> {
    const base64 = (req.base64 || '').trim()
    const mediaType = req.mediaType
    if (!base64) throw new Error('base64 is required')
    if (!mediaType) throw new Error('mediaType is required')
    if (!RESOURCE_CATEGORIES.length) throw new Error('No categories configured')

    const res = await openrouterChat({
      pipeline: 'resource_tagger',
      userText: buildTagResourcePrompt(RESOURCE_CATEGORIES),
      maxTokens: 500,
      responseFormatJson: true,
      image: { mediaType, base64 },
      metadata: {
        media_type: mediaType
      }
    })

    const parsed = extractJson(res.text) as Record<string, unknown>

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
}
