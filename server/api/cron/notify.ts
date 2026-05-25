import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'

type PreferenceType =
  | 'category'
  | 'regulation'
  | 'jurisdiction'
  | 'company'
  | 'industry'
  | 'ioc_type'
  | 'freetext'

type PreferenceRow = {
  subscriber_id: string
  preference_type: PreferenceType
  preference_value: string
}

type ChannelRow = {
  subscriber_id: string
  channel_type: string
}

type ArticleMatchInput = {
  id: string
  title: string
  ai_summary: string
  jurisdiction: string
  regulation: string
  category_slug: string
  tag_slugs: string[]
  ioc_types: string[]
}

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

function lower(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

function extractTagSlugs(articleTags: unknown): string[] {
  if (!Array.isArray(articleTags)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of articleTags) {
    if (!row || typeof row !== 'object') continue
    const category = (row as Record<string, unknown>).category
    if (!category || typeof category !== 'object') continue
    const slug = lower((category as Record<string, unknown>).slug)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

function extractIocTypes(articleIocs: unknown): string[] {
  if (!Array.isArray(articleIocs)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of articleIocs) {
    if (!row || typeof row !== 'object') continue
    const type = lower((row as Record<string, unknown>).type)
    if (!type || seen.has(type)) continue
    seen.add(type)
    out.push(type)
  }
  return out
}

function articleMatchesPreference(article: ArticleMatchInput, pref: PreferenceRow): boolean {
  const prefValue = (pref.preference_value ?? '').trim()
  if (!prefValue) return false

  switch (pref.preference_type) {
    case 'category': {
      const needle = lower(prefValue)
      return lower(article.category_slug) === needle || article.tag_slugs.some((s) => lower(s) === needle)
    }

    case 'regulation': {
      return lower(article.regulation) === lower(prefValue)
    }

    case 'jurisdiction': {
      return lower(article.jurisdiction) === lower(prefValue)
    }

    case 'company':
    case 'industry':
    case 'freetext': {
      const needle = lower(prefValue)
      if (!needle) return false
      const haystack = `${article.title} ${article.ai_summary}`.toLowerCase()
      return haystack.includes(needle)
    }

    case 'ioc_type': {
      const needle = lower(prefValue)
      return article.ioc_types.some((t) => lower(t) === needle)
    }

    default:
      return false
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const supabase = useSupabaseAdmin()

  const cutoffIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const selectFields = [
    'id',
    'title',
    'ai_summary',
    'jurisdiction',
    'regulation',
    'updated_at',
    'category:categories!articles_category_id_fkey(slug)',
    'article_tags(category:categories!article_tags_category_id_fkey(slug))',
    'article_iocs:article_iocs!article_iocs_article_id_fkey(type)'
  ].join(',')

  const { data: rawArticles, error: articlesErr } = await supabase
    .from('articles')
    .select(selectFields)
    .eq('status', 'approved')
    .gt('updated_at', cutoffIso)

  if (articlesErr) {
    console.error('[cron/notify] DB error loading articles:', articlesErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const articleRows = Array.isArray(rawArticles) ? rawArticles : []
  const candidateArticleIds = articleRows
    .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>).id : null))
    .filter((id): id is string => typeof id === 'string' && !!id)

  // Filter out any articles that already have notification_log entries.
  let eligibleArticles = articleRows
  if (candidateArticleIds.length > 0) {
    const { data: existingLogs, error: logsErr } = await supabase
      .from('notification_log')
      .select('article_id')
      .in('article_id', candidateArticleIds)

    if (logsErr) {
      console.error('[cron/notify] DB error loading notification_log:', logsErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const existingArticleIds = new Set<string>()
    for (const row of existingLogs ?? []) {
      if (!row || typeof row !== 'object') continue
      const id = (row as Record<string, unknown>).article_id
      if (typeof id === 'string' && id) existingArticleIds.add(id)
    }

    eligibleArticles = articleRows.filter((r) => {
      if (!r || typeof r !== 'object') return false
      const id = (r as Record<string, unknown>).id
      return typeof id === 'string' && id ? !existingArticleIds.has(id) : false
    })
  }

  const articles: ArticleMatchInput[] = []
  for (const row of eligibleArticles) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id : ''
    const title = typeof rec.title === 'string' ? rec.title : ''
    if (!id || !title) continue

    const category = rec.category && typeof rec.category === 'object' ? (rec.category as Record<string, unknown>) : null
    const categorySlug = lower(category?.slug)
    const tagSlugs = extractTagSlugs(rec.article_tags)
    const iocTypes = extractIocTypes(rec.article_iocs)

    articles.push({
      id,
      title,
      ai_summary: typeof rec.ai_summary === 'string' ? rec.ai_summary : '',
      jurisdiction: typeof rec.jurisdiction === 'string' ? rec.jurisdiction : '',
      regulation: typeof rec.regulation === 'string' ? rec.regulation : '',
      category_slug: categorySlug,
      tag_slugs: tagSlugs,
      ioc_types: iocTypes
    })
  }

  if (articles.length === 0) {
    console.log('[notify] matched 0 notifications for 0 articles across 0 subscribers')
    return { matched: 0, articles: 0, subscribers: 0 }
  }

  // Load preferences for verified subscribers.
  const { data: prefRows, error: prefErr } = await supabase
    .from('subscriber_preferences')
    .select('subscriber_id,preference_type,preference_value,subscribers!inner(id)')
    .eq('subscribers.verified', true)

  if (prefErr) {
    console.error('[cron/notify] DB error loading subscriber_preferences:', prefErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Load active+verified channels for verified subscribers.
  const { data: channelRows, error: chanErr } = await supabase
    .from('subscriber_channels')
    .select('subscriber_id,channel_type,subscribers!inner(id)')
    .eq('subscribers.verified', true)
    .eq('is_active', true)
    .eq('verified', true)

  if (chanErr) {
    console.error('[cron/notify] DB error loading subscriber_channels:', chanErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const prefsBySubscriber = new Map<string, PreferenceRow[]>()
  for (const row of (prefRows ?? []) as unknown[]) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const subscriber_id = typeof rec.subscriber_id === 'string' ? rec.subscriber_id : ''
    const preference_type = typeof rec.preference_type === 'string' ? (rec.preference_type as PreferenceType) : null
    const preference_value = typeof rec.preference_value === 'string' ? rec.preference_value : ''
    if (!subscriber_id || !preference_type || !preference_value) continue

    const arr = prefsBySubscriber.get(subscriber_id)
    const pref: PreferenceRow = { subscriber_id, preference_type, preference_value }
    if (arr) arr.push(pref)
    else prefsBySubscriber.set(subscriber_id, [pref])
  }

  const channelsBySubscriber = new Map<string, string[]>()
  for (const row of (channelRows ?? []) as unknown as ChannelRow[]) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const subscriber_id = typeof rec.subscriber_id === 'string' ? rec.subscriber_id : ''
    const channel_type = typeof rec.channel_type === 'string' ? rec.channel_type : ''
    if (!subscriber_id || !channel_type) continue
    const arr = channelsBySubscriber.get(subscriber_id)
    if (arr) arr.push(channel_type)
    else channelsBySubscriber.set(subscriber_id, [channel_type])
  }

  const rowsToInsert: Array<{ subscriber_id: string; article_id: string; channel_type: string; status: 'pending' }> = []
  const matchedArticleIds = new Set<string>()
  const matchedSubscriberIds = new Set<string>()

  for (const [subscriberId, prefs] of prefsBySubscriber.entries()) {
    const channels = channelsBySubscriber.get(subscriberId) ?? []
    if (channels.length === 0 || prefs.length === 0) continue

    for (const article of articles) {
      const matches = prefs.some((p) => articleMatchesPreference(article, p))
      if (!matches) continue

      matchedArticleIds.add(article.id)
      matchedSubscriberIds.add(subscriberId)
      for (const channelType of channels) {
        rowsToInsert.push({
          subscriber_id: subscriberId,
          article_id: article.id,
          channel_type: channelType,
          status: 'pending'
        })
      }
    }
  }

  if (rowsToInsert.length === 0) {
    console.log(`[notify] matched 0 notifications for ${articles.length} articles across ${prefsBySubscriber.size} subscribers`)
    return { matched: 0, articles: 0, subscribers: 0 }
  }

  // Insert in chunks to stay under payload limits.
  for (const batch of chunk(rowsToInsert, 500)) {
    const { error: insertErr } = await supabase
      .from('notification_log')
      .upsert(batch as unknown as Array<Record<string, unknown>>, {
        onConflict: 'subscriber_id,article_id,channel_type',
        ignoreDuplicates: true
      })

    if (insertErr) {
      console.error('[cron/notify] DB error inserting notification_log:', insertErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
  }

  console.log(
    `[notify] matched ${rowsToInsert.length} notifications for ${matchedArticleIds.size} articles across ${matchedSubscriberIds.size} subscribers`
  )

  return {
    matched: rowsToInsert.length,
    articles: matchedArticleIds.size,
    subscribers: matchedSubscriberIds.size
  }
})
