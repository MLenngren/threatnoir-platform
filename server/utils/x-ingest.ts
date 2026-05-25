type TweetEntityUrl = {
  expanded_url?: string
  display_url?: string
  url?: string
}

export interface Tweet {
  id: string
  text: string
  created_at: string
  author_id: string
  entities?: {
    urls?: TweetEntityUrl[]
  }
  attachments?: {
    media_keys?: string[]
  }
}

export interface XMedia {
  media_key: string
  type: string // 'photo' | 'video' | 'animated_gif'
  url?: string
  preview_image_url?: string
}

export interface XUser {
  id: string
  username: string
  name: string
}

function safeBigInt(id: string): bigint | null {
  try {
    // Tweet IDs are snowflakes (numeric strings)
    return BigInt(id)
  } catch {
    return null
  }
}

/**
 * Splits usernames into multiple (from:user OR from:user2 ...) query batches
 * that safely fit X's 512-char query limit.
 */
function batchUsernamesForQuery(usernames: string[]): string[][] {
  const batches: string[][] = []

  let current: string[] = []
  let currentLen = 0

  for (const raw of usernames) {
    const u = raw.trim()
    if (!u) continue

    const token = `from:${u}`
    const addition = current.length === 0 ? token.length : ` OR ${token}`.length

    // Keep a little headroom for safety.
    // We append additional query filters later (e.g. " -is:retweet -is:reply"),
    // so the usable budget for the from:... OR from:... portion is lower.
    if (currentLen + addition > 455) {
      if (current.length) batches.push(current)
      current = [u]
      currentLen = token.length
      continue
    }

    current.push(u)
    currentLen += addition
  }

  if (current.length) batches.push(current)
  return batches
}

export async function fetchRecentTweets(usernames: string[], sinceId?: string): Promise<{
  tweets: Tweet[]
  users: Map<string, XUser>
  media: Map<string, XMedia>
  newestId?: string
}> {
  const bearerToken = process.env.X_BEARER_TOKEN
  if (!bearerToken) throw new Error('X_BEARER_TOKEN not configured')

  const batches = batchUsernamesForQuery(usernames)

  const byId = new Map<string, Tweet>()
  const users = new Map<string, XUser>()
  const media = new Map<string, XMedia>()

  let newestId: string | undefined
  let newestBig: bigint | null = null

  for (const batch of batches) {
    // Query-level filters are "free" and reduce noise before we spend anything downstream.
    const query = batch.map((u) => `from:${u}`).join(' OR ') + ' -is:retweet -is:reply'

    const params = new URLSearchParams({
      query,
      max_results: '100',
      'tweet.fields': 'created_at,author_id,entities,attachments',
      expansions: 'author_id,attachments.media_keys',
      'user.fields': 'username,name',
      'media.fields': 'url,preview_image_url,type'
    })
    if (sinceId) params.set('since_id', sinceId)

    const resp = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`
        }
      }
    )

    if (!resp.ok) {
      // Best-effort: don't fail the whole run if one batch errors.
      console.error(`X API error: ${resp.status} ${await resp.text()}`)
      continue
    }

    const data = (await resp.json()) as {
      data?: Tweet[]
      includes?: { users?: XUser[]; media?: XMedia[] }
    }

    for (const u of data.includes?.users ?? []) {
      if (u?.id) users.set(u.id, u)
    }

    // Build media lookup
    for (const m of data.includes?.media ?? []) {
      if (m?.media_key) media.set(m.media_key, m)
    }

    for (const t of data.data ?? []) {
      if (!t?.id) continue
      byId.set(t.id, t)

      const b = safeBigInt(t.id)
      if (!b) continue
      if (newestBig === null || b > newestBig) {
        newestBig = b
        newestId = t.id
      }
    }
  }

  return {
    tweets: [...byId.values()],
    users,
    media,
    newestId
  }
}
