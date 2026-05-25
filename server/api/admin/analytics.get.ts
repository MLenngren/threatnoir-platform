import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../utils/requireAdmin'

type RangeKey = '7d' | '30d' | '90d'
type Query = { range?: string }

type AnalyticsRow = {
  event_type: string
  path: string | null
  referrer: string | null
  ip_hash: string | null
  created_at: string
}

function rangeToDays(range: string | undefined): number {
  const r = (range || '').trim()
  if (r === '7d') return 7
  if (r === '30d') return 30
  if (r === '90d') return 90
  return 30
}

function isoDay(iso: string): string {
  // created_at is timestamptz; normalizing to UTC day is good enough for a small dashboard
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return 'invalid'
  }
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<Query>(event)
  const days = rangeToDays(query.range)
  const range = (query.range === '7d' || query.range === '30d' || query.range === '90d' ? query.range : `${days}d`) as RangeKey

  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  // Fetch all rows in range (paginate to avoid API max-rows defaults)
  const pageSize = 1000
  const maxPages = 200
  const rows: AnalyticsRow[] = []

  for (let page = 0; page < maxPages; page++) {
    const start = page * pageSize
    const end = start + pageSize - 1

    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type,path,referrer,ip_hash,created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .range(start, end)

    if (error) {
      console.error('[admin/analytics.get] DB error:', error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const chunk = (data ?? []) as unknown as AnalyticsRow[]
    rows.push(...chunk)

    if (chunk.length < pageSize) break
  }

  // Aggregations
  const dailyViews = new Map<string, number>()
  const topPages = new Map<string, number>()
  const topReferrers = new Map<string, number>()
  const eventBreakdown = new Map<string, number>()
  const visitorHashes = new Set<string>()

  let totalViews = 0
  let signups = 0
  let podcastPlays = 0

  for (const r of rows) {
    const type = String(r.event_type || '').trim()
    if (!type) continue

    eventBreakdown.set(type, (eventBreakdown.get(type) ?? 0) + 1)

    if (r.ip_hash) visitorHashes.add(r.ip_hash)

    if (type === 'page_view') {
      totalViews++
      const day = isoDay(r.created_at)
      dailyViews.set(day, (dailyViews.get(day) ?? 0) + 1)

      const p = (r.path || '').trim() || '(unknown)'
      topPages.set(p, (topPages.get(p) ?? 0) + 1)

      const ref = (r.referrer || '').trim() || '(direct)'
      topReferrers.set(ref, (topReferrers.get(ref) ?? 0) + 1)
    }

    if (type === 'email_signup') signups++
    if (type === 'podcast_play') podcastPlays++
  }

  const daily_views = Array.from(dailyViews.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  const top_pages = Array.from(topPages.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }))

  const top_referrers = Array.from(topReferrers.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }))

  const event_breakdown = Array.from(eventBreakdown.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([event_type, count]) => ({ event_type, count }))

  return {
    range,
    period: { from: fromIso, to: toIso },
    daily_views,
    total_views: totalViews,
    unique_visitors: visitorHashes.size,
    top_pages,
    top_referrers,
    event_breakdown,
    signups,
    podcast_plays: podcastPlays
  }
})
