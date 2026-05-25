import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit } from '../../utils/rateLimit'

type NotificationsQuery = {
  key?: string
  since?: string
  limit?: string
}

type NotificationItem = {
  article_id: string
  title: string | null
  brief: string | null
  url: string
  regulation: string | null
  jurisdiction: string | null
  fine_amount: string | null
  published_at: string | null
  matched_at: string
}

function parseSince(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const d = new Date(raw)
  if (!Number.isFinite(d.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid since date' })
  }
  return d.toISOString()
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<NotificationsQuery>(event)

  const key = (query.key ?? '').trim()
  if (!key) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Authenticate API key against subscriber_channels (api channel)
  const channelRes = await supabase
    .from('subscriber_channels')
    .select('subscriber_id')
    .eq('channel_type', 'api')
    .eq('is_active', true)
    .eq('verified', true)
    .eq('channel_config->>api_key', key)
    .maybeSingle()

  if (channelRes.error) {
    console.error('[v1/notifications.get] DB error (auth):', channelRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!channelRes.data?.subscriber_id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const subscriberId = channelRes.data.subscriber_id

  // Rate limit: 60 requests/min per API key (not IP)
  const { allowed } = checkRateLimit(`v1:notifications:${key}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const since = parseSince(query.since)
  const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 50)

  let db = supabase
    .from('notification_log')
    .select(
      `article_id,created_at,
      article:articles!notification_log_article_id_fkey(id,title,brief,url,regulation,jurisdiction,fine_amount,published_at)`
    )
    .eq('subscriber_id', subscriberId)
    .eq('channel_type', 'api')
    .in('status', ['pending', 'sent'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (since) {
    db = db.gte('articles.published_at', since)
  }

  const { data, error } = await db
  if (error) {
    console.error('[v1/notifications.get] DB error (fetch):', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items: NotificationItem[] = (data ?? [])
    .map((row) => {
      const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
      const articleId = typeof rec.article_id === 'string' ? rec.article_id : null
      const matchedAt = typeof rec.created_at === 'string' ? rec.created_at : null
      const article = rec.article && typeof rec.article === 'object' ? (rec.article as Record<string, unknown>) : {}

      const url = typeof article.url === 'string' ? article.url : null
      if (!articleId || !matchedAt || !url) return null

      return {
        article_id: articleId,
        title: typeof article.title === 'string' ? article.title : null,
        brief: typeof article.brief === 'string' ? article.brief : null,
        url,
        regulation: typeof article.regulation === 'string' ? article.regulation : null,
        jurisdiction: typeof article.jurisdiction === 'string' ? article.jurisdiction : null,
        fine_amount: typeof article.fine_amount === 'string' ? article.fine_amount : null,
        published_at: typeof article.published_at === 'string' ? article.published_at : null,
        matched_at: matchedAt
      }
    })
    .filter((v): v is NotificationItem => !!v)

  return { items, count: items.length }
})
