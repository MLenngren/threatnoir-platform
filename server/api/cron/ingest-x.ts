import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { fetchUrlMeta } from '../../utils/fetchMeta'
import { safeCompare } from '../../utils/safeCompare'
import { generateArticleSlug } from '../../utils/slugify'
import { useSupabaseAdmin } from '../../utils/supabase'
import { fetchRecentTweets, type Tweet } from '../../utils/x-ingest'
import { isSecurityRelevant } from '../../utils/relevanceCheck'

const MAX_ARTICLE_AGE_HOURS = Number(process.env.MAX_ARTICLE_AGE_HOURS) || 48

const requireCronSecret = (event: H3Event) => {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRON_SECRET is not configured'
    })
  }

  const headerSecret = getHeader(event, 'x-cron-secret')
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  const provided = headerSecret || bearer

  if (!provided || !safeCompare(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

function truncate(input: string, max: number) {
  const s = (input || '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 3)).trim()}...`
}

function isExternalUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate)
    const host = u.hostname.toLowerCase()
    if (host === 'x.com' || host.endsWith('.x.com')) return false
    if (host === 'twitter.com' || host.endsWith('.twitter.com')) return false
    if (host === 't.co') return false
    return true
  } catch {
    return false
  }
}

function externalUrls(tweet: Tweet): string[] {
  const urls = tweet.entities?.urls ?? []

  const out: string[] = []
  for (const u of urls) {
    const expanded = (u.expanded_url || u.url || '').trim()
    if (!expanded) continue
    if (!isExternalUrl(expanded)) continue
    if (!out.includes(expanded)) out.push(expanded)
  }
  return out
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0

  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (true) {
      const idx = i
      i += 1
      if (idx >= items.length) return
      out[idx] = await fn(items[idx])
    }
  })

  await Promise.all(workers)
  return out
}

async function getOrCreateXSource(supabase: ReturnType<typeof useSupabaseAdmin>) {
  const { data: existing, error: existingError } = await supabase
    .from('sources')
    .select('id,name,url,type,last_since_id')
    .eq('type', 'api')
    .eq('name', 'X / Twitter')
    .limit(1)
    .maybeSingle()

  if (existingError) {
		console.error('[cron/ingest-x] DB error:', existingError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (existing?.id) return existing

  const { data: created, error: createdError } = await supabase
    .from('sources')
    .insert({
      name: 'X / Twitter',
      url: 'https://api.twitter.com/2/tweets/search/recent',
      type: 'api',
      is_active: true
    })
    .select('id,name,url,type,last_since_id')
    .single()

  if (createdError) {
		console.error('[cron/ingest-x] DB error:', createdError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  return created
}

function tweetUrl(maybeUsername: string | null, tweetId: string) {
  if (maybeUsername) return `https://x.com/${maybeUsername}/status/${tweetId}`
  return `https://x.com/i/web/status/${tweetId}`
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const supabase = useSupabaseAdmin()

  const { data: accounts, error: accountsError } = await supabase
    .from('x_accounts')
    .select('username')
    .eq('is_active', true)
    .order('username', { ascending: true })

  if (accountsError) {
		console.error('[cron/ingest-x] DB error:', accountsError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const usernames = (accounts ?? []).map((a) => (a as { username: string }).username).filter(Boolean)
  if (usernames.length === 0) {
    return { fetched: 0, new: 0, linked: 0, skipped: 0, stale: 0, filtered: 0, errors: [] }
  }

  const source = await getOrCreateXSource(supabase)
  const sinceId = (source as { last_since_id?: string | null }).last_since_id ?? undefined

  let fetched = 0
  let created = 0
  let linkedCreated = 0
  let skipped = 0
  let filtered = 0
  let stale = 0
  const errors: Array<{ tweet_id?: string; message: string }> = []

  const { tweets, users, media: mediaMap, newestId } = await fetchRecentTweets(usernames, sinceId)
  fetched = tweets.length

  const usernameByAuthorId = new Map<string, string>()
  for (const u of users.values()) {
    if (u?.id && u?.username) usernameByAuthorId.set(u.id, u.username)
  }

  // Helper: get first photo URL from tweet media attachments
  function tweetImageUrl(t: Tweet): string | null {
    const keys = t.attachments?.media_keys ?? []
    for (const key of keys) {
      const m = mediaMap.get(key)
      if (m && m.type === 'photo' && m.url) return m.url
      if (m && m.preview_image_url) return m.preview_image_url
    }
    return null
  }

  // Build a unique set of candidate tweet URLs for dedupe checks.
  const byTweetUrl = new Map<string, { tweet: Tweet; externalUrls: string[] }>()
  for (const t of tweets) {
    try {
      const authorUsername = usernameByAuthorId.get(t.author_id) ?? null
      const url = tweetUrl(authorUsername, t.id)
      if (!url) continue
      if (!byTweetUrl.has(url)) byTweetUrl.set(url, { tweet: t, externalUrls: externalUrls(t) })
    } catch (err: unknown) {
      errors.push({ tweet_id: t?.id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  const candidateUrls = [...byTweetUrl.keys()]
  if (candidateUrls.length === 0) {
    // Update bookkeeping even if nothing to insert.
    const patch: Record<string, unknown> = { last_fetched_at: new Date().toISOString() }
    if (newestId) patch.last_since_id = newestId
    await supabase.from('sources').update(patch).eq('id', source.id)
    return { fetched, new: 0, linked: 0, skipped, stale, filtered, errors }
  }

  const { data: existing, error: existingError } = await supabase
    .from('articles')
    .select('url')
    .in('url', candidateUrls)

  if (existingError) {
		console.error('[cron/ingest-x] DB error:', existingError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const existingSet = new Set((existing ?? []).map((r) => (r as { url: string }).url))
  const toCreate = candidateUrls.filter((u) => !existingSet.has(u))
  skipped = candidateUrls.length - toCreate.length

  type Row = {
    title: string
	    slug: string
    url: string
    summary: string | null
    image_url: string | null
    published_at: string | null
    source_id: string
    status: 'pending'
    submitted_via: 'x'
  }

  const rows = await mapLimit(toCreate, 6, async (url): Promise<Row | null> => {
    const ctx = byTweetUrl.get(url)
    if (!ctx) return null

    const t = ctx.tweet
    const publishedAt = (t.created_at || '').trim() || null
    const text = (t.text || '').trim()

    // Skip stale tweets
    if (publishedAt) {
      const cutoff = new Date(Date.now() - MAX_ARTICLE_AGE_HOURS * 60 * 60 * 1000)
      if (new Date(publishedAt) < cutoff) {
        stale += 1
        return null
      }
    }

    // Check relevance before we store anything (best-effort; on AI errors/quota, it passes through).
    const relevant = await isSecurityRelevant(text)
    if (!relevant) {
      filtered += 1
      return null
    }

    // Store the tweet itself as an article (tweet URL).
    const title = truncate(text, 100) || url
    const summary = text || null

    return {
      title,
	      slug: generateArticleSlug(title, url),
      url,
      summary,
      image_url: tweetImageUrl(t),
      published_at: publishedAt,
      source_id: source.id,
      status: 'pending',
      submitted_via: 'x'
    }
  })

  const finalRows = rows.filter(Boolean) as Row[]
  if (finalRows.length > 0) {
    const { error: insertError } = await supabase
      .from('articles')
      .upsert(finalRows as unknown as Array<Record<string, unknown>>, {
        onConflict: 'url',
        ignoreDuplicates: true
      })

    if (insertError) {
			console.error('[cron/ingest-x] DB error:', insertError.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    created = finalRows.length
  }

  // Follow external URLs (max 2 per tweet) and ingest them as separate pending articles.
  // Best-effort: failures here should not fail the whole cron.
  await mapLimit(finalRows, 4, async (row) => {
    const ctx = byTweetUrl.get(row.url)
    if (!ctx) return

    const t = ctx.tweet
    const publishedAt = (t.created_at || '').trim() || null
    const urls = ctx.externalUrls.slice(0, 2)
    if (urls.length === 0) return

    for (const url of urls) {
      try {
        const { data: existingLink } = await supabase
          .from('articles')
          .select('id')
          .eq('url', url)
          .maybeSingle()

        if (existingLink?.id) continue

        const meta = await fetchUrlMeta(url)
        if (!meta.title) continue

        const nowIso = new Date().toISOString()
        const { error: insertErr } = await supabase
          .from('articles')
          .insert({
            title: meta.title,
	            slug: generateArticleSlug(meta.title, url),
            url,
            summary: meta.description || null,
            image_url: meta.image || tweetImageUrl(ctx.tweet) || null,
            source_id: source.id,
            status: 'pending',
            submitted_via: 'x_link',
            published_at: publishedAt,
            ingested_at: nowIso
          })

        if (!insertErr) {
          linkedCreated += 1
        } else if ((insertErr as { code?: string }).code === '23505') {
          // unique(url) race
          continue
        } else {
          console.error(`Failed to insert linked URL ${url}:`, insertErr)
        }
      } catch (err) {
        console.error(`Failed to fetch linked URL ${url}:`, err)
      }
    }
  })

  const patch: Record<string, unknown> = { last_fetched_at: new Date().toISOString() }
  if (newestId) patch.last_since_id = newestId
  await supabase.from('sources').update(patch).eq('id', source.id)

  return {
    fetched,
    new: created,
    linked: linkedCreated,
    skipped,
    stale,
    filtered,
    errors
  }
})
