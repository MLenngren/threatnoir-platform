import { spawn } from 'node:child_process'

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

const AI_CLI_BIN = (process.env.AI_CLI_BIN || 'claude').trim() || 'claude'
const AI_CLI_ARGS = (process.env.AI_CLI_ARGS || '--print').split(/\s+/).filter(Boolean)
const AI_CLI_TIMEOUT_MS = (() => {
  const raw = Number.parseInt(String(process.env.AI_CLI_TIMEOUT_MS ?? ''), 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 60_000
})()

// Security: validate binary name to prevent injection and unexpected shell metacharacters.
// Note: we never invoke a shell (spawn with args array), but this prevents operators
// from accidentally setting something like "foo; rm -rf /".
if (!/^[a-zA-Z0-9._\/-]+$/.test(AI_CLI_BIN)) {
  throw new Error(`AI_CLI_BIN contains invalid characters: ${AI_CLI_BIN}`)
}

function minimalCliEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  if (process.env.PATH) env.PATH = process.env.PATH
  if (process.env.HOME) env.HOME = process.env.HOME
  return env
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

async function cliInvoke(params: {
  pipeline: string
  systemText?: string
  userText: string
  metadata?: Record<string, unknown>
}): Promise<{ text: string; modelKey: string; durationMs: number }> {
  const startedAt = Date.now()
  const modelKey = `cli:${AI_CLI_BIN}`

  let stdout = ''
  let stderr = ''

  try {
    const text = await new Promise<string>((resolve, reject) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), AI_CLI_TIMEOUT_MS)

      const proc = spawn(AI_CLI_BIN, AI_CLI_ARGS, {
        stdio: ['pipe', 'pipe', 'pipe'],
        signal: controller.signal,
        // Don't leak env vars to the CLI — only pass what's needed.
        env: minimalCliEnv()
      })

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      proc.on('error', (err) => {
        clearTimeout(timeoutId)
        reject(err)
      })

      proc.on('close', (code, signal) => {
        clearTimeout(timeoutId)

        if (code === 0) {
          resolve(stdout)
          return
        }

        const details = [
          `bin=${AI_CLI_BIN}`,
          `code=${String(code)}`,
          signal ? `signal=${signal}` : null,
          stderr.trim() ? `stderr=${stderr.trim().slice(0, 600)}` : null,
          stdout.trim() ? `stdout=${stdout.trim().slice(0, 600)}` : null
        ]
          .filter(Boolean)
          .join(' ')

        reject(new Error(`[cli] invocation failed (${details})`))
      })

      const systemText = (params.systemText || '').trim()
      const userText = (params.userText || '').trim()
      const combined = systemText ? `${systemText}\n\n---\n\n${userText}` : userText
      proc.stdin.write(combined)
      proc.stdin.end()
    })

    const durationMs = Date.now() - startedAt
    await logAiCall({
      pipeline: params.pipeline,
      model: modelKey,
      response: {
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0
        }
      },
      durationMs,
      status: 'success',
      metadata: {
        provider: 'cli',
        cli_bin: AI_CLI_BIN,
        cli_args: AI_CLI_ARGS,
        ...(params.metadata ?? {})
      },
      costMicroCentsOverride: 0
    })

    return { text, modelKey, durationMs }
  } catch (err) {
    const durationMs = Date.now() - startedAt
    await logAiCall({
      pipeline: params.pipeline,
      model: modelKey,
      response: null,
      durationMs,
      status: 'error',
      metadata: {
        provider: 'cli',
        cli_bin: AI_CLI_BIN,
        cli_args: AI_CLI_ARGS,
        stderr: stderr.trim() ? stderr.trim().slice(0, 600) : null,
        stdout: stdout.trim() ? stdout.trim().slice(0, 600) : null,
        ...(params.metadata ?? {})
      },
      costMicroCentsOverride: 0
    })

    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`[cli] failed running ${AI_CLI_BIN}: ${msg}`, { cause: err as unknown })
  }
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

export const cliProvider: Provider = {
  async classifyAndSummarize(title: string, summary: string | null, fullText: string | null): Promise<ClassifiedSummary> {
    const res = await cliInvoke({
      pipeline: 'article_summarize',
      systemText: ARTICLE_SYSTEM,
      userText: buildSummarizeArticleUserText(title, summary, fullText),
      metadata: {
        title: title.slice(0, 200),
        hasSummary: Boolean(summary),
        hasFullText: Boolean(fullText)
      }
    })

    return parseClassifiedSummaryFromText({ title, text: res.text })
  },

  async extractIocs(title: string, summary: string | null, fullText: string | null): Promise<ExtractIocsResponse> {
    const res = await cliInvoke({
      pipeline: 'iocs_extract',
      systemText: ARTICLE_SYSTEM,
      userText: buildSummarizeArticleUserText(title, summary, fullText),
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
    const res = await cliInvoke({
      pipeline: 'awareness_lesson',
      systemText: AWARENESS_SYSTEM,
      userText: buildGenerateAwarenessUserText(title, summary),
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
    const res = await cliInvoke({
      pipeline: 'relevance_check',
      systemText: RELEVANCE_SYSTEM,
      userText: buildRelevanceUserText(text),
      metadata: {
        text_len: (text || '').length
      }
    })

    const out = unwrapJsonStringIfNeeded(res.text).trim().toUpperCase()
    return out.startsWith('YES')
  },

  async draftSocialPost(params: DraftSocialPostRequest): Promise<DraftSocialPostResponse> {
    const res = await cliInvoke({
      pipeline: 'social_draft',
      systemText: SOCIAL_SYSTEM,
      userText: buildDraftSocialUserText(params),
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
      const res2 = await cliInvoke({
        pipeline: 'social_draft',
        systemText: SHORTEN_INSTRUCTIONS,
        userText: shortenUserPrompt,
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

    const res = await cliInvoke({
      pipeline: 'video_briefing',
      systemText: SHOW_SYSTEM,
      userText: buildShowUserPrompt(title, script),
      metadata: {
        title: title.slice(0, 200)
      }
    })

    const summary = (res.text || '').trim()
    if (!summary) throw new Error('Empty model response')
    return { summary, costCents: 0 }
  },

  async draftWeeklyRoundup(req: DraftWeeklyRoundupRequest): Promise<DraftWeeklyRoundupResponse> {
    const siteName = (req.siteName || '').trim()
    const siteUrl = (req.siteUrl || '').trim()
    if (!siteName) throw new Error('siteName is required')
    if (!siteUrl) throw new Error('siteUrl is required')

    const prompt = buildWeeklyRoundupPrompt({ siteName, siteUrl, promptPayload: req.promptPayload })
    const res = await cliInvoke({
      pipeline: 'weekly_roundup',
      userText: prompt,
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

    const res = await cliInvoke({
      pipeline: 'auto_focus',
      userText: prompt,
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

    const res = await cliInvoke({
      pipeline: 'linkedin_focus_draft',
      systemText: buildLinkedinVoicePrompt(siteName),
      userText: buildLinkedinFocusUserPrompt(siteUrl, focus),
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
    const res = await cliInvoke({
      pipeline: 'related_articles',
      userText: buildFindRelatedPrompt(req),
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

    const res = await cliInvoke({
      pipeline: 'linkedin_midweek',
      systemText: buildLinkedinVoicePrompt(siteName),
      userText: buildLinkedinMidweekUserPrompt(siteUrl, req.article),
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

    // CLI providers vary in multimodal support. As a best-effort, embed the image
    // as a data URL in the prompt.
    const dataUrl = `data:${mediaType};base64,${base64}`

    const res = await cliInvoke({
      pipeline: 'resource_tagger',
      userText: `${buildTagResourcePrompt(RESOURCE_CATEGORIES)}\n\nImage (data URL):\n${dataUrl}`,
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
