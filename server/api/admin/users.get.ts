import { createError, defineEventHandler, getQuery } from 'h3'

import { requireAdminUser } from '../../utils/requireAdmin'

type UsersQuery = {
  page?: string
  perPage?: string
  search?: string
  blocked?: string
}

type ProfileRow = {
  user_id: string
  display_name: string | null
  is_blocked: boolean
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const q = getQuery<UsersQuery>(event)

  const page = Math.max(Number.parseInt((q.page ?? '1').toString(), 10) || 1, 1)
  const perPage = Math.min(Math.max(Number.parseInt((q.perPage ?? '50').toString(), 10) || 50, 1), 100)
  const search = (typeof q.search === 'string' ? q.search : '').trim().toLowerCase()
  const blockedRaw = (typeof q.blocked === 'string' ? q.blocked : '').trim().toLowerCase()
  const blockedFilter: 'all' | 'blocked' | 'active' =
    blockedRaw === 'true' || blockedRaw === 'blocked' ? 'blocked' : blockedRaw === 'false' || blockedRaw === 'active' ? 'active' : 'all'

  // Supabase admin listUsers does not support searching.
  // For filtered requests, we fetch a larger first page and paginate in-memory.
  const needsFilter = !!search || blockedFilter !== 'all'
  const fetchPage = needsFilter ? 1 : page
  const fetchPerPage = needsFilter ? 1000 : perPage

  const res = await supabase.auth.admin.listUsers({ page: fetchPage, perPage: fetchPerPage })
  if (res.error) {
    console.error('[admin/users.get] Supabase auth error:', res.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const authUsers = res.data?.users ?? []
  const ids = authUsers.map((u) => u.id).filter(Boolean)

  const profilesRes = ids.length
    ? await supabase.from('profiles').select('user_id,display_name,is_blocked').in('user_id', ids)
    : { data: [] as ProfileRow[], error: null as null | { message: string } }

  if (profilesRes.error) {
    console.error('[admin/users.get] DB error (profiles):', profilesRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const profileByUserId = new Map<string, ProfileRow>()
  for (const p of profilesRes.data ?? []) {
    if (p?.user_id) profileByUserId.set(p.user_id, p)
  }

  const items = authUsers.map((u) => {
    const p = profileByUserId.get(u.id)
    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: (u as unknown as Record<string, unknown>).last_sign_in_at as string | null,
      display_name: p?.display_name ?? null,
      is_blocked: p?.is_blocked ?? false
    }
  })

  let filtered = items
  if (search) {
    filtered = filtered.filter((u) => {
      const email = (u.email ?? '').toLowerCase()
      const name = (u.display_name ?? '').toLowerCase()
      return u.id.toLowerCase().includes(search) || email.includes(search) || name.includes(search)
    })
  }

  if (blockedFilter === 'blocked') {
    filtered = filtered.filter((u) => u.is_blocked)
  } else if (blockedFilter === 'active') {
    filtered = filtered.filter((u) => !u.is_blocked)
  }

  // If we filtered in-memory, apply the requested pagination on the filtered list.
  const paged = needsFilter ? filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage) : filtered

  return {
    users: paged,
    page,
    perPage,
    total: needsFilter ? filtered.length : res.data?.total ?? authUsers.length,
    returned: paged.length
  }
})
