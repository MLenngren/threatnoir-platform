import { defineEventHandler } from 'h3'
import { requireAdminUser } from '../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [totalArticles, pendingArticles, approvedToday, activeSources] = await Promise.all([
    supabase.from('articles').select('id', { count: 'exact', head: true }),
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('published_at', startOfToday.toISOString()),
    supabase.from('sources').select('id', { count: 'exact', head: true }).eq('is_active', true)
  ])

  return {
    totalArticles: totalArticles.count ?? 0,
    pendingArticles: pendingArticles.count ?? 0,
    approvedToday: approvedToday.count ?? 0,
    activeSources: activeSources.count ?? 0
  }
})
