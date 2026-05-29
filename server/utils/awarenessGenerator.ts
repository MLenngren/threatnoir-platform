import type { SupabaseClient } from '@supabase/supabase-js'

import Anthropic from '@anthropic-ai/sdk'

import { logAiCall } from './aiUsage'

export type AwarenessGeneratorOptions = {
  maxPerRun?: number // default 10
  hoursBack?: number // default 24
}

export type AwarenessGeneratorResult = {
  processed: number
  created: number
  skipped_existing: number
  errors: Array<{ article_id: string; error: string }>
}

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('No JSON in response')
  return JSON.parse(m[0])
}

function cleanText(v: unknown, max: number): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return ''
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1)).trim()}…`
}

function generateSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100)
}

export async function generateAwarenessLessons(
  supabase: SupabaseClient,
  options?: AwarenessGeneratorOptions
): Promise<AwarenessGeneratorResult> {
  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
  const gatewayToken = gatewayUrl ? process.env.AI_GATEWAY_INTERNAL_TOKEN : null
  if (gatewayUrl && (!gatewayToken || !gatewayToken.trim())) {
    throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
  }

  const maxPerRun = Number.isFinite(options?.maxPerRun ?? NaN) ? (options?.maxPerRun as number) : 10
  const hoursBack = Number.isFinite(options?.hoursBack ?? NaN) ? (options?.hoursBack as number) : 24

  const cutoffIso = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

  const { data: tags, error: tagsErr } = await supabase
    .from('awareness_tags')
    .select('id,slug,name')
    .order('name', { ascending: true })

  if (tagsErr) {
    console.error('[cron/generate-awareness] DB error (tags):', tagsErr.message)
    throw new Error('Internal server error')
  }

  const tagBySlug = new Map<string, { id: string; slug: string; name: string }>()
  for (const t of tags ?? []) {
    const rec = t && typeof t === 'object' ? (t as Record<string, unknown>) : {}
    const slug = typeof rec.slug === 'string' ? rec.slug : ''
    const id = typeof rec.id === 'string' ? rec.id : ''
    const name = typeof rec.name === 'string' ? rec.name : ''
    if (slug && id) tagBySlug.set(slug, { id, slug, name })
  }

  const { data: articles, error: artErr } = await supabase
    .from('articles')
    .select('id,title,url,summary,ai_summary,published_at,ingested_at')
    .eq('status', 'approved')
    .or(`published_at.gte.${cutoffIso},ingested_at.gte.${cutoffIso}`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })
    .limit(50)

  if (artErr) {
    console.error('[cron/generate-awareness] DB error (articles):', artErr.message)
    throw new Error('Internal server error')
  }

  const articleRows = (articles ?? []) as Array<Record<string, unknown>>
  const articleIds = articleRows.map((a) => String(a.id ?? '')).filter(Boolean)
  if (articleIds.length === 0) {
    return { processed: 0, created: 0, skipped_existing: 0, errors: [] }
  }

  const { data: existingLessons, error: lessonErr } = await supabase
    .from('awareness_lessons')
    .select('article_id')
    .in('article_id', articleIds)
    .limit(5000)

  if (lessonErr) {
    console.error('[cron/generate-awareness] DB error (existing lessons):', lessonErr.message)
    throw new Error('Internal server error')
  }

  const existingArticleIds = new Set(
    (existingLessons ?? [])
      .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>).article_id : null))
      .filter((v): v is string => typeof v === 'string' && !!v)
  )

  const candidates = articleRows.filter((a) => {
    const id = String(a.id ?? '')
    return id && !existingArticleIds.has(id)
  })

  const toProcess = candidates.slice(0, maxPerRun)
  if (toProcess.length === 0) {
    return { processed: 0, created: 0, skipped_existing: candidates.length, errors: [] }
  }

  const client = gatewayUrl ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let created = 0
  const errors: Array<{ article_id: string; error: string }> = []

  for (const a of toProcess) {
    const articleId = String(a.id ?? '')
    const title = cleanText(a.title, 200)
    const summary = cleanText(a.ai_summary || a.summary, 1800)

    try {
      let parsed: Record<string, unknown>

      if (gatewayUrl) {
        const base = gatewayUrl.replace(/\/+$/, '')
        const url = `${base}/generate-awareness`
        const timeoutMs = Number(process.env.AI_GATEWAY_TIMEOUT_MS) || 60_000
        let res: Awaited<ReturnType<typeof fetch>>
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-gateway-token': gatewayToken as string
            },
            body: JSON.stringify({ title, summary }),
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
          throw new Error(
            `[ai-gateway] ${res.status} calling ${url}: ` + (body ? body.slice(0, 800) : res.statusText)
          )
        }

        parsed = (await res.json()) as Record<string, unknown>
      } else {
        const prompt = `You are a security awareness analyst. Given this security news article, identify:
1. The root cause category (one of: Patch Management, Access Control, Configuration Management, Security Awareness, Incident Response, Network Segmentation, Data Protection, Supply Chain, Logging & Monitoring, Regulatory Compliance, Backup & Recovery, Vulnerability Management)
2. Write a concise lesson (3-5 sentences) explaining what went wrong and why it matters
3. Write a structured "prevention" section with actionable bullet points
4. List relevant framework references (CIS Controls, NIST, ITIL, GDPR articles, etc.)

Article title: ${title}
Article summary: ${summary}

IMPORTANT — the "prevention" field must be structured with markdown-style bullet points, NOT a wall of text. Format like this:
"prevention": "**Immediate actions:**\n- Patch or upgrade affected systems to the latest version\n- Enable automated vulnerability scanning for internet-facing assets\n\n**Long-term improvements:**\n- Implement emergency patching procedures for critical infrastructure\n- Maintain an accurate inventory of all network appliances\n- Establish network segmentation around critical systems"

Each prevention should have 2-3 categories (e.g., Immediate actions, Long-term improvements, Detection measures) with 2-3 bullet points each. Keep each bullet point to ONE actionable sentence.

Respond in JSON: { "categories": ["slug1", "slug2"], "title": "short headline", "body": "lesson text", "prevention": "structured prevention with bullet points", "framework_refs": ["CIS Control 7", "NIST AC-2"] }

Allowed category slugs (use ONLY from this list):
patch-management
access-control
configuration-management
security-awareness
incident-response
network-segmentation
data-protection
supply-chain
logging-monitoring
regulatory-compliance
backup-recovery
vulnerability-management`

        const model = 'claude-sonnet-4-20250514'
        const startedAt = Date.now()
        const resp = await (client as Anthropic).messages.create({
          model,
          max_tokens: 900,
          messages: [{ role: 'user', content: prompt }]
        })

        await logAiCall({
          pipeline: 'awareness_lesson',
          model,
          response: resp,
          durationMs: Date.now() - startedAt,
          metadata: {
            article_id: articleId,
            title
          }
        })

        const text = resp.content?.[0]?.type === 'text' ? resp.content[0].text : ''
        parsed = extractJson(text) as Record<string, unknown>
      }

      const lessonTitle = cleanText(parsed.title, 200) || `Awareness Lessons: ${title}`.slice(0, 200)
      const body = typeof parsed.body === 'string' ? parsed.body.trim() : ''
      const prevention = typeof parsed.prevention === 'string' ? parsed.prevention.trim() : null
      const frameworkRefs = Array.isArray(parsed.framework_refs)
        ? parsed.framework_refs
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean)
            .slice(0, 20)
        : []

      if (!body) throw new Error('Model response missing body')

      const categorySlugs = Array.isArray(parsed.categories)
        ? Array.from(
            new Set(
              parsed.categories
                .map((x) => (typeof x === 'string' ? x.trim() : ''))
                .filter((x): x is string => !!x)
            )
          ).slice(0, 3)
        : []

      const tagIds = categorySlugs
        .map((slug) => tagBySlug.get(slug)?.id)
        .filter((v): v is string => typeof v === 'string' && !!v)

      const baseSlug =
        generateSlug(lessonTitle) ||
        generateSlug(`lesson ${articleId}`) ||
        `lesson-${Date.now().toString(10)}`

      const insertPayloadBase = {
        article_id: articleId,
        title: lessonTitle,
        body,
        prevention,
        framework_refs: frameworkRefs,
        status: 'published',
        published_at: new Date().toISOString()
      }

      let insertRes = await supabase
        .from('awareness_lessons')
        .insert({ ...insertPayloadBase, slug: baseSlug })
        .select('id')
        .single()

      // If slug collides (unique index), retry with timestamp suffix.
      if (insertRes.error && (insertRes.error as unknown as { code?: string }).code === '23505') {
        const suffix = Date.now().toString(10)
        const head = baseSlug.slice(0, Math.max(0, 100 - (suffix.length + 1)))
        const fallbackSlug = `${head}-${suffix}`
        insertRes = await supabase
          .from('awareness_lessons')
          .insert({ ...insertPayloadBase, slug: fallbackSlug })
          .select('id')
          .single()
      }

      if (insertRes.error) {
        console.error('[cron/generate-awareness] DB error (insert lesson):', insertRes.error.message)
        throw new Error(insertRes.error.message)
      }

      const lessonId = insertRes.data.id
      if (tagIds.length) {
        const { error: tagErr } = await supabase
          .from('awareness_lesson_tags')
          .insert(tagIds.map((tag_id) => ({ lesson_id: lessonId, tag_id })))
        if (tagErr) {
          console.error('[cron/generate-awareness] DB error (insert tags):', tagErr.message)
          // best-effort: leave lesson without tags
        }
      }

      created += 1
      console.log(`[cron/generate-awareness] created draft lesson for article ${articleId}: ${lessonTitle}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ article_id: articleId, error: msg })
      console.error('[cron/generate-awareness] error:', articleId, msg)
    }
  }

  return {
    processed: toProcess.length,
    created,
    skipped_existing: existingArticleIds.size,
    errors
  }
}
