import { validateUrlSafe } from './ssrf'

export type RedditPost = {
  id: string
  title: string
  url: string
  permalink: string
  selftext: string
  score: number
  created_utc: number
  stickied: boolean
  is_self: boolean
  subreddit: string
}

type RedditListing = {
  data?: {
    children?: Array<{
      kind?: string
      data?: Record<string, unknown>
    }>
  }
}

const USER_AGENT = 'ThreatNoirBot/1.0 (+https://threatnoir.com)'

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function permalinkToUrl(permalink: string): string {
  const p = (permalink || '').trim()
  if (!p) return ''
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  return `https://www.reddit.com${p.startsWith('/') ? '' : '/'}${p}`
}

function normalizeHttpUrlOrEmpty(value: string): string {
  const input = (value || '').trim()
  if (!input) return ''
  try {
    const u = new URL(input)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.toString()
  } catch {
    return ''
  }
}

function mapChildToPost(child: { kind?: string; data?: Record<string, unknown> }): RedditPost | null {
  if (!child || child.kind !== 't3' || !child.data) return null
  const d = child.data

  const id = asString(d.id).trim()
  const title = asString(d.title).trim()
  const subreddit = asString(d.subreddit).trim()
  const permalink = permalinkToUrl(asString(d.permalink))

  // For link posts, prefer url_overridden_by_dest when present.
  const linkUrl = normalizeHttpUrlOrEmpty(asString(d.url_overridden_by_dest) || asString(d.url))
  const isSelf = Boolean(d.is_self)
  const url = isSelf ? permalink : linkUrl

  const selftext = asString(d.selftext)
  const score = asNumber(d.score)
  const createdUtc = asNumber(d.created_utc)
  const stickied = Boolean(d.stickied)

  if (!id || !title || !url || !permalink) return null

  return {
    id,
    title,
    url,
    permalink,
    selftext,
    score,
    created_utc: createdUtc,
    stickied,
    is_self: isSelf,
    subreddit
  }
}

export type FetchRedditOptions = {
  limit?: number
}

export async function fetchSubredditNew(subreddit: string, opts: FetchRedditOptions = {}): Promise<RedditPost[]> {
  const name = (subreddit || '').trim().replace(/^r\//i, '')
  if (!name) return []

  const limit = Math.max(1, Math.min(100, Number(opts.limit ?? 25)))
  const url = `https://www.reddit.com/r/${encodeURIComponent(name)}/new.json?limit=${limit}`

  // SSRF safety (defense-in-depth): this is a fixed host, but keep the guardrail.
  await validateUrlSafe(url)

  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json'
    }
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Reddit fetch failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const json = (await res.json().catch(() => null)) as RedditListing | null
  const children = json?.data?.children ?? []

  const out: RedditPost[] = []
  for (const c of children) {
    const mapped = mapChildToPost(c)
    if (mapped) out.push(mapped)
  }
  return out
}

export type RedditQualityFilter = {
  minScore?: number
  minSelfTextChars?: number
}

export function filterRedditPosts(posts: RedditPost[], opts: RedditQualityFilter = {}): RedditPost[] {
  const minScore = Number(opts.minScore ?? 5)
  const minSelfChars = Number(opts.minSelfTextChars ?? 100)

  return (posts ?? []).filter((p) => {
    if (!p) return false
    if (p.stickied) return false
    if (p.score < minScore) return false

    if (p.is_self) {
      const t = (p.selftext || '').trim()
      if (t.length < minSelfChars) return false
    }

    return true
  })
}
