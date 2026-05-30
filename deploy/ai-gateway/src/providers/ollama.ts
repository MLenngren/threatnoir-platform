import { logAiCall } from '../usage.js'
import { cleanArticleText } from '../utils/textClean.js'
import { STABLE_INSTRUCTIONS as ARTICLE_SYSTEM } from '../prompts/summarize-article.js'
import { STABLE_INSTRUCTIONS as AWARENESS_SYSTEM } from '../prompts/generate-awareness.js'
import { STABLE_INSTRUCTIONS as RELEVANCE_SYSTEM } from '../prompts/rank-articles.js'
import { SHORTEN_INSTRUCTIONS, STABLE_INSTRUCTIONS as SOCIAL_SYSTEM } from '../prompts/draft-social-post.js'
import { STABLE_SYSTEM as SHOW_SYSTEM, buildUserPrompt as buildShowUserPrompt } from '../prompts/summarize-show.js'
import { buildWeeklyRoundupPrompt } from '../prompts/weekly-roundup.js'
import { buildAutoFocusPrompt } from '../prompts/auto-focus.js'
import { buildLinkedinVoicePrompt } from '../prompts/linkedin-voice.js'
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

type OllamaGenerateApiResponse = {
  response?: string
  model?: string
  done?: boolean
  done_reason?: string
  prompt_eval_count?: number
  eval_count?: number
}

function normalizeBaseUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

function getOllamaBaseUrl(): string {
  return normalizeBaseUrl(process.env.OLLAMA_BASE_URL || 'http://localhost:11434')
}

function getOllamaModel(): string {
  return (process.env.OLLAMA_MODEL || 'llama3.1:8b').trim() || 'llama3.1:8b'
}

function unwrapJsonStringIfNeeded(text: string): string {
  const t = (text || '').trim()
  if (!t) return ''
  if (t.startsWith('"')) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (typeof parsed === 'string') return parsed
    } catch {
      // fall through
    }
  }
  return t
}

async function ollamaGenerate(params: {
  pipeline: string
  systemText?: string
  userText: string
  maxTokens?: number
  temperature?: number
  imageBase64?: string
  metadata?: Record<string, unknown>
}): Promise<{ text: string; model: string; durationMs: number }>
{
  const startedAt = Date.now()
  const baseUrl = getOllamaBaseUrl()
  const model = getOllamaModel()
  const ollamaModelKey = `ollama:${model}`

  const body: Record<string, unknown> = {
    model,
    prompt: params.userText,
    stream: false,
    format: 'json'
  }
  if (params.systemText) body.system = params.systemText
  if (typeof params.maxTokens === 'number') body.options = { ...(body.options as object), num_predict: params.maxTokens }
  if (typeof params.temperature === 'number') body.options = { ...(body.options as object), temperature: params.temperature }
  if (params.imageBase64) body.images = [params.imageBase64]

  let data: OllamaGenerateApiResponse | null = null

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Ollama error ${res.status}: ${errText.slice(0, 200)}`)
    }

    data = (await res.json()) as OllamaGenerateApiResponse
  } catch (err) {
    await logAiCall({
      pipeline: params.pipeline,
      model: ollamaModelKey,
      response: null,
      durationMs: Date.now() - startedAt,
      status: 'error',
      metadata: {
        provider: 'ollama',
        base_url: baseUrl,
        ...(params.metadata ?? {})
      }
    })

    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[ollama] failed calling ${baseUrl}/api/generate: ${msg}`, { cause: err as unknown })
  }

  const durationMs = Date.now() - startedAt
  const responseText = typeof data?.response === 'string' ? data.response : ''
  const inputTokens = Math.max(0, Math.round(data?.prompt_eval_count ?? 0))
  const outputTokens = Math.max(0, Math.round(data?.eval_count ?? 0))

  await logAiCall({
    pipeline: params.pipeline,
    model: ollamaModelKey,
    response: {
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0
      }
    },
    durationMs,
    status: 'success',
    metadata: {
      provider: 'ollama',
      base_url: baseUrl,
      ...(params.metadata ?? {})
    }
  })

  return { text: responseText, model: ollamaModelKey, durationMs }
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

export const ollamaProvider: Provider = {
  async classifyAndSummarize(title: string, summary: string | null, fullText: string | null): Promise<ClassifiedSummary> {
    const userText = buildSummarizeArticleUserText(title, summary, fullText)
    const res = await ollamaGenerate({
      pipeline: 'article_summarize',
      systemText: ARTICLE_SYSTEM,
      userText,
      maxTokens: 1000,
      metadata: {
        title: title.slice(0, 200),
        hasSummary: Boolean(summary),
        hasFullText: Boolean(fullText)
      }
    })

    return parseClassifiedSummaryFromText({ title, text: res.text })
  },

  async extractIocs(title: string, summary: string | null, fullText: string | null): Promise<ExtractIocsResponse> {
    const userText = buildSummarizeArticleUserText(title, summary, fullText)
    const res = await ollamaGenerate({
      pipeline: 'iocs_extract',
      systemText: ARTICLE_SYSTEM,
      userText,
      maxTokens: 1000,
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
    const userText = buildGenerateAwarenessUserText(title, summary)
    const res = await ollamaGenerate({
      pipeline: 'awareness_lesson',
      systemText: AWARENESS_SYSTEM,
      userText,
      maxTokens: 900,
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
    const res = await ollamaGenerate({
      pipeline: 'relevance_check',
      systemText: RELEVANCE_SYSTEM,
      userText: buildRelevanceUserText(text),
      maxTokens: 10,
      metadata: {
        text_len: (text || '').length
      }
    })

    const out = unwrapJsonStringIfNeeded(res.text).trim().toUpperCase()
    return out.startsWith('YES')
  },

  async draftSocialPost(params: DraftSocialPostRequest): Promise<DraftSocialPostResponse> {
    const res = await ollamaGenerate({
      pipeline: 'social_draft',
      systemText: SOCIAL_SYSTEM,
      userText: buildDraftSocialUserText(params),
      maxTokens: 900,
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
      const res2 = await ollamaGenerate({
        pipeline: 'social_draft',
        systemText: SHORTEN_INSTRUCTIONS,
        userText: shortenUserPrompt,
        maxTokens: 200,
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

    const res = await ollamaGenerate({
      pipeline: 'video_briefing',
      systemText: SHOW_SYSTEM,
      userText: buildShowUserPrompt(title, script),
      maxTokens: 140,
      temperature: 0.2,
      metadata: {
        title: title.slice(0, 200)
      }
    })

    const summary = unwrapJsonStringIfNeeded(res.text).trim()
    if (!summary) throw new Error('Empty model response')
    return { summary, costCents: 0 }
  },

  async draftWeeklyRoundup(req: DraftWeeklyRoundupRequest): Promise<DraftWeeklyRoundupResponse> {
    const siteName = (req.siteName || '').trim()
    const siteUrl = (req.siteUrl || '').trim()
    if (!siteName) throw new Error('siteName is required')
    if (!siteUrl) throw new Error('siteUrl is required')

    const prompt = buildWeeklyRoundupPrompt({ siteName, siteUrl, promptPayload: req.promptPayload })
    const res = await ollamaGenerate({
      pipeline: 'weekly_roundup',
      userText: prompt,
      maxTokens: 6000,
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

    const res = await ollamaGenerate({
      pipeline: 'auto_focus',
      userText: prompt,
      maxTokens: 400,
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

    const res = await ollamaGenerate({
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

    const text = unwrapJsonStringIfNeeded(res.text).trim()
    if (!text) throw new Error('Model response was empty')
    return { text }
  },

  async findRelatedArticles(req: FindRelatedArticlesRequest): Promise<FindRelatedArticlesResponse> {
    const res = await ollamaGenerate({
      pipeline: 'related_articles',
      userText: buildFindRelatedPrompt(req),
      maxTokens: 10,
      metadata: {
        parent_title: (req.parentTitle || '').slice(0, 160),
        child_title: (req.childTitle || '').slice(0, 160)
      }
    })

    const text = unwrapJsonStringIfNeeded(res.text).trim().toUpperCase()
    return { decision: text.startsWith('YES') }
  },

  async draftLinkedinMidweek(req: DraftLinkedinMidweekRequest): Promise<DraftLinkedinMidweekResponse> {
    const siteName = (req.siteName || '').trim()
    const siteUrl = (req.siteUrl || '').trim()
    if (!siteName) throw new Error('siteName is required')
    if (!siteUrl) throw new Error('siteUrl is required')

    const res = await ollamaGenerate({
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

    const text = unwrapJsonStringIfNeeded(res.text).trim()
    if (!text) throw new Error('Model response was empty')
    return { text }
  },

  async tagResource(req: TagResourceRequest): Promise<TagResourceResponse> {
    const base64 = (req.base64 || '').trim()
    if (!base64) throw new Error('base64 is required')
    if (!RESOURCE_CATEGORIES.length) throw new Error('No categories configured')

    const res = await ollamaGenerate({
      pipeline: 'resource_tagger',
      userText: buildTagResourcePrompt(RESOURCE_CATEGORIES),
      maxTokens: 500,
      imageBase64: base64,
      metadata: {
        media_type: req.mediaType
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
