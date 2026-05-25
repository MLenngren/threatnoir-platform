import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Query = {
  status?: string
  search?: string
  limit?: string
  offset?: string
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<Query>(event)

  const status = typeof query.status === 'string' ? query.status.trim() : 'all'
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
  const limit = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 500)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)

  let db = supabase
    .from('subscribers')
    .select('id,email,name,verified,created_at,updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status === 'verified') {
    db = db.eq('verified', true)
  } else if (status === 'pending') {
    db = db.eq('verified', false)
  }

  if (search) {
    db = db.ilike('email', `%${search}%`)
  }

  const { data, count, error } = await db.range(offset, offset + limit - 1)

  if (error) {
    console.error('[admin/subscribers/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string
    email: string
    name: string | null
    verified: boolean
    created_at: string
    updated_at: string
  }>

  // Fetch channels for all subscribers in one query
  const ids = rows.map((r) => r.id)
  const channelsMap = new Map<string, Array<{ type: string; verified: boolean; is_active: boolean }>>()

  if (ids.length > 0) {
    const { data: chans } = await supabase
      .from('subscriber_channels')
      .select('subscriber_id,channel_type,verified,is_active')
      .in('subscriber_id', ids)

    for (const c of (chans ?? []) as Array<{ subscriber_id: string; channel_type: string; verified: boolean; is_active: boolean }>) {
      const list = channelsMap.get(c.subscriber_id) ?? []
      list.push({ type: c.channel_type, verified: c.verified, is_active: c.is_active })
      channelsMap.set(c.subscriber_id, list)
    }
  }

  // Aggregate counts for dashboard
  const [totalRes, verifiedRes, pendingRes] = await Promise.all([
    supabase.from('subscribers').select('*', { count: 'exact', head: true }),
    supabase.from('subscribers').select('*', { count: 'exact', head: true }).eq('verified', true),
    supabase.from('subscribers').select('*', { count: 'exact', head: true }).eq('verified', false)
  ])

  const items = rows.map((r) => ({
    ...r,
    channels: channelsMap.get(r.id) ?? []
  }))

  return {
    items,
    total: count ?? items.length,
    stats: {
      total: totalRes.count ?? 0,
      verified: verifiedRes.count ?? 0,
      pending: pendingRes.count ?? 0
    }
  }
})
