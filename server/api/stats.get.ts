import { defineEventHandler, setResponseHeader } from 'h3'

import { useSupabaseAdmin } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const supabase = useSupabaseAdmin()

  // Cache for 5 minutes (CDN)
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    articlesTodayRes,
    totalArticlesRes,
    latestPodcastRes,
    focusCountRes,
    awarenessCountRes,
    latestWeeklyRes
  ] = await Promise.all([
    supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('published_at', todayStart),
    supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase
      .from('podcast_episodes')
      .select('id,date,edition,title')
      .order('date', { ascending: false })
      .order('edition', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('focus_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('awareness_lessons')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase
      .from('weekly_roundups')
      .select('week_label,slug')
      .eq('status', 'published')
      .order('date_from', { ascending: false })
      .limit(1)
      .maybeSingle()
  ])

  // Log errors but keep endpoint best-effort (never hard-fail the landing page)
  if (articlesTodayRes.error) console.error('[stats.get] articles_today error:', articlesTodayRes.error.message)
  if (totalArticlesRes.error) console.error('[stats.get] total_articles error:', totalArticlesRes.error.message)
  if (latestPodcastRes.error) console.error('[stats.get] latest_podcast error:', latestPodcastRes.error.message)
  if (focusCountRes.error) console.error('[stats.get] active_focus_items error:', focusCountRes.error.message)
  if (awarenessCountRes.error) console.error('[stats.get] awareness_lessons error:', awarenessCountRes.error.message)
  if (latestWeeklyRes.error) console.error('[stats.get] latest_weekly error:', latestWeeklyRes.error.message)

  // Compute hours since latest podcast
  let latestPodcastHoursAgo: number | null = null
  let latestPodcastDate: string | null = null
  if (latestPodcastRes.data?.date) {
    latestPodcastDate = latestPodcastRes.data.date
    // Estimate time based on edition (morning ~06:00, afternoon ~14:00 UTC)
    const edition = latestPodcastRes.data.edition
    const hour = edition === 'afternoon' ? 14 : 6
    const episodeTime = new Date(`${latestPodcastRes.data.date}T${String(hour).padStart(2, '0')}:00:00Z`)
    const diffMs = now.getTime() - episodeTime.getTime()
    latestPodcastHoursAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
  }

  return {
    articles_today: articlesTodayRes.count ?? 0,
    total_articles: totalArticlesRes.count ?? 0,
    active_focus_items: focusCountRes.count ?? 0,
    awareness_lessons: awarenessCountRes.count ?? 0,
    latest_podcast: {
      hours_ago: latestPodcastHoursAgo,
      date: latestPodcastDate,
      edition: latestPodcastRes.data?.edition ?? null,
      title: latestPodcastRes.data?.title ?? null
    },
    latest_weekly: latestWeeklyRes.data
      ? {
          week_label: latestWeeklyRes.data.week_label,
          slug: latestWeeklyRes.data.slug
        }
      : null
  }
})
