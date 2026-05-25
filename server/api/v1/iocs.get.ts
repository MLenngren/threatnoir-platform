import { setResponseHeader } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { escapeIlike } from '../../utils/escapeIlike'
import { authenticateApiKey } from '../../utils/apiKeyAuth'

type IocsQuery = {
  type?: string
  q?: string
  limit?: string
  offset?: string
}

const IOC_TYPES = [
  'ip',
  'domain',
  'hash_md5',
  'hash_sha1',
  'hash_sha256',
  'url',
  'cve',
  'mitre_attack',
  'email',
  'malware'
] as const

const VALID_TYPES = new Set<string>(IOC_TYPES)

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const query = getQuery<IocsQuery>(event)

  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)
  const type = (query.type ?? '').trim() || null
  const rawQ = (query.q ?? '').trim()
  const q = rawQ ? rawQ.replace(/<[^>]*>/g, '').trim() || null : null

  if (q && q.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Search query too long (max 200 chars)' })
  }

  // Authenticate API key on all requests — throws 401 if key is invalid/revoked
  const apiKeyAuth = await authenticateApiKey(event)

  // Rate limit + result limits
  const isSearch = Boolean(q)
  const maxResults = isSearch && !apiKeyAuth ? 10 : 50
  const defaultLimit = maxResults
  const limit = Math.min(Math.max(Number(query.limit ?? defaultLimit) || defaultLimit, 1), maxResults)

  let maxRequests: number
  let rateLimitKey: string
  let windowMs: number

  if (!isSearch) {
    // Keep existing listing rate limit unchanged
    maxRequests = 30
    windowMs = 60_000
    rateLimitKey = `v1:iocs:${ip}`
  } else if (apiKeyAuth) {
    // Authenticated search (existing)
    maxRequests = 100
    windowMs = 60_000
    rateLimitKey = `apikey:${apiKeyAuth.keyId}`
  } else {
    // Free unauthenticated search tier
    maxRequests = 10
    windowMs = 3_600_000
    rateLimitKey = `v1:iocs:search:${ip}`
  }

  const { allowed, remaining } = checkRateLimit(rateLimitKey, maxRequests, windowMs)
  setResponseHeader(event, 'X-RateLimit-Limit', String(maxRequests))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(remaining))

  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  if (type && !VALID_TYPES.has(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid type' })
  }

  const supabase = serverSupabaseServiceRole(event)

  let db = supabase
    .from('article_iocs')
    .select(
      `type,value,context,created_at,
      article:articles!article_iocs_article_id_fkey!inner(id,title,url,published_at,status)`
    )
    .eq('articles.status', 'approved')
    .order('created_at', { ascending: false })

  if (type) db = db.eq('type', type)
  if (q) db = db.ilike('value', `%${escapeIlike(q)}%`)

  // Fetch limit+1 to determine hasMore
  const { data, error } = await db.range(offset, offset + limit)
  if (error) {
    console.error('[v1/iocs.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = Array.isArray(data) ? data : []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const items = page.map((row) => {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const article = rec.article && typeof rec.article === 'object' ? (rec.article as Record<string, unknown>) : {}
    return {
      type: String(rec.type ?? ''),
      value: String(rec.value ?? ''),
      context: typeof rec.context === 'string' ? rec.context : null,
      article: {
        id: String(article.id ?? ''),
        title: String(article.title ?? ''),
        url: String(article.url ?? ''),
        published_at: typeof article.published_at === 'string' ? article.published_at : null
      }
    }
  })

  return {
    items,
    hasMore,
    nextOffset: offset + items.length
  }
})
