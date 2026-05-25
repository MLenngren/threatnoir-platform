import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const query = getQuery(event)

  const statusRaw = typeof query.status === 'string' ? query.status : 'pending'
  const status = statusRaw === 'approved' || statusRaw === 'rejected' || statusRaw === 'pending' ? statusRaw : 'pending'

  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 50) || 50))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('tip_submissions')
    .select(
      'id,title,body,suggested_category,submitter_name,submitter_email,status,reviewer_notes,reviewed_at,created_at',
      { count: 'exact' }
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[admin/tips/submissions.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return {
    page,
    pageSize,
    total: count ?? 0,
    submissions: data ?? []
  }
})
