import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

type Query = {
  status?: string
}

type EventRow = {
  id: string
  title: string
  slug: string
  description: string | null
  url: string | null
  start_date: string
  end_date: string | null
  location: string | null
  is_virtual: boolean
  organizer: string | null
  category: string | null
  tags: unknown
  source_name: string | null
  status: string
  is_community_submitted: boolean
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery<Query>(event)

  const statusRaw = typeof query.status === 'string' ? query.status.trim().toLowerCase() : ''
  const status = statusRaw === 'pending' || statusRaw === 'approved' || statusRaw === 'rejected' ? statusRaw : null

  let db = supabase
    .from('events')
    .select(
      [
        'id',
        'title',
        'slug',
        'description',
        'url',
        'start_date',
        'end_date',
        'location',
        'is_virtual',
        'organizer',
        'category',
        'tags',
        'source_name',
        'status',
        'is_community_submitted',
        'created_at',
        'updated_at'
      ].join(',')
    )
    .order('created_at', { ascending: false })

  if (status) db = db.eq('status', status)

  const { data, error } = await db
  if (error) {
    console.error('[admin/events/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return {
    items: (data ?? []) as EventRow[]
  }
})
