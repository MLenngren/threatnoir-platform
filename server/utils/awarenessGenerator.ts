import type { SupabaseClient } from '@supabase/supabase-js'

import { generateAwarenessLessonDirect } from './anthropic'

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
	        parsed = await generateAwarenessLessonDirect({ article_id: articleId, title, summary })
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
