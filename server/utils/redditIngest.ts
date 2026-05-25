import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchSubredditNew, filterRedditPosts, type RedditPost } from './reddit'
import { generateArticleSlug } from './slugify'

export type RedditSource = {
  id: string
  name: string
  url: string
}

export type RedditIngestResult = {
  fetched: number
  created: number
  skipped: number
  stale: number
  errors: Array<{ source_id?: string; source_name?: string; message: string }>
}

function truncate(input: string, max: number) {
  const s = (input || '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 3)).trim()}...`
}

function subredditFromSource(source: RedditSource): string {
  const byName = (source.name || '').trim()
  if (/^r\//i.test(byName)) return byName.replace(/^r\//i, '').trim()

  try {
    const u = new URL(source.url)
    const m = u.pathname.match(/\/r\/([^/]+)/i)
    if (m?.[1]) return m[1].trim()
  } catch {
    // ignore
  }

  return ''
}

function toPublishedAtIso(createdUtc: number): string | null {
  if (!createdUtc || !Number.isFinite(createdUtc)) return null
  const d = new Date(createdUtc * 1000)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (true) {
      const idx = i
      i += 1
      if (idx >= items.length) return
      await fn(items[idx])
    }
  })
  await Promise.all(workers)
}

export async function ingestRedditSources(opts: {
  supabase: SupabaseClient
  sources: RedditSource[]
  maxArticleAgeHours: number
  limitPerSubreddit?: number
}): Promise<RedditIngestResult> {
  const { supabase, sources, maxArticleAgeHours } = opts
  const limitPerSubreddit = Math.max(1, Math.min(100, Number(opts.limitPerSubreddit ?? 25)))

  let fetched = 0
  let created = 0
  let skipped = 0
  let stale = 0
  const errors: Array<{ source_id?: string; source_name?: string; message: string }> = []

  for (const source of sources ?? []) {
    const sourceName = source?.name
    try {
      const subreddit = subredditFromSource(source)
      if (!subreddit) {
        throw new Error(`Could not infer subreddit from source: name=${source?.name} url=${source?.url}`)
      }

      const raw = await fetchSubredditNew(subreddit, { limit: limitPerSubreddit })
      const filtered = filterRedditPosts(raw, { minScore: 5, minSelfTextChars: 100 })

      // De-dupe within response (by Reddit post ID) first
      const byId = new Map<string, RedditPost>()
      for (const p of filtered) {
        if (!byId.has(p.id)) byId.set(p.id, p)
      }
      const unique = [...byId.values()]

      // Filter out stale posts
      const cutoff = new Date(Date.now() - maxArticleAgeHours * 60 * 60 * 1000)
      const fresh = unique.filter((p) => {
        const publishedAt = toPublishedAtIso(p.created_utc)
        if (!publishedAt) return true
        return new Date(publishedAt) >= cutoff
      })
      stale += unique.length - fresh.length

      fetched += fresh.length
      if (fresh.length === 0) {
        await supabase.from('sources').update({ last_fetched_at: new Date().toISOString() }).eq('id', source.id)
        continue
      }

      const candidateUrls = fresh.map((p) => p.url)
      const candidateIds = fresh.map((p) => p.id)

      const [{ data: existingByUrl, error: urlErr }, { data: existingById, error: idErr }] = await Promise.all([
        supabase.from('articles').select('url').in('url', candidateUrls),
        supabase.from('articles').select('reddit_post_id').in('reddit_post_id', candidateIds)
      ])

      if (urlErr) {
        console.error('[reddit/ingest] DB error:', urlErr.message)
        throw new Error('Internal server error')
      }
      if (idErr) {
        console.error('[reddit/ingest] DB error:', idErr.message)
        throw new Error('Internal server error')
      }

      const urlSet = new Set((existingByUrl ?? []).map((r) => (r as { url: string }).url))
      const idSet = new Set((existingById ?? []).map((r) => (r as { reddit_post_id: string }).reddit_post_id))

      const toInsert = fresh.filter((p) => !urlSet.has(p.url) && !idSet.has(p.id))
      skipped += fresh.length - toInsert.length

      const nowIso = new Date().toISOString()
      await mapLimit(toInsert, 6, async (p) => {
        const publishedAt = toPublishedAtIso(p.created_utc)
        const summary = p.is_self ? truncate(p.selftext || '', 4000) || null : null

        const { error: insertErr } = await supabase.from('articles').insert({
          title: p.title,
	          slug: generateArticleSlug(p.title, p.url),
          url: p.url,
          summary,
          image_url: null,
          published_at: publishedAt,
          source_id: source.id,
          status: 'pending',
          submitted_via: 'reddit',
          reddit_post_id: p.id,
          ingested_at: nowIso
        })

        if (!insertErr) {
          created += 1
          return
        }

        if ((insertErr as { code?: string }).code === '23505') {
          // unique(url) or unique(reddit_post_id) race
          skipped += 1
          return
        }

        console.error('[reddit/ingest] DB insert error:', insertErr)
        errors.push({ source_id: source.id, source_name: sourceName, message: insertErr.message })
      })

      await supabase.from('sources').update({ last_fetched_at: new Date().toISOString() }).eq('id', source.id)
    } catch (err: unknown) {
      errors.push({
        source_id: source?.id,
        source_name: sourceName,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return { fetched, created, skipped, stale, errors }
}
