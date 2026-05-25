import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import {
  attachArticlesToFocusItems,
  cleanOptionalText,
  findUniqueFocusSlug,
	generateFocusSlug,
	normalizeFocusStringArray,
  normalizeUuidArray,
  VALID_FOCUS_CATEGORIES,
  VALID_FOCUS_SEVERITIES,
  VALID_FOCUS_STATUSES
} from '../../../utils/focusItems'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

type Body = {
  title?: unknown
  slug?: unknown
  summary?: unknown
  severity?: unknown
  category?: unknown
  cve_ids?: unknown
  affected_products?: unknown
  action_required?: unknown
  article_ids?: unknown
  ioc_summary?: unknown
  source_urls?: unknown
  status?: unknown
  expires_at?: unknown
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid focus item id' })
  }

  const body = (await readBody(event)) as Body

  const existingRes = await supabase.from('focus_items').select('id,status,expires_at,slug').eq('id', id).maybeSingle()
  if (existingRes.error) {
    console.error('[admin/focus/[id].patch] DB error (lookup):', existingRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!existingRes.data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const update: Record<string, unknown> = {}

  if (typeof body?.title !== 'undefined') {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) throw createError({ statusCode: 400, statusMessage: 'Invalid title' })
    update.title = title.length <= 200 ? title : title.slice(0, 200)
  }

  if (typeof body?.summary !== 'undefined') {
    const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
    if (!summary) throw createError({ statusCode: 400, statusMessage: 'Invalid summary' })
    update.summary = summary.length <= 4000 ? summary : summary.slice(0, 4000)
  }

  if (typeof body?.severity !== 'undefined') {
    const s = typeof body.severity === 'string' ? body.severity.trim().toLowerCase() : ''
    if (!VALID_FOCUS_SEVERITIES.has(s)) throw createError({ statusCode: 400, statusMessage: 'Invalid severity' })
    update.severity = s
  }

  if (typeof body?.category !== 'undefined') {
    const c = typeof body.category === 'string' ? body.category.trim().toLowerCase() : ''
    if (!VALID_FOCUS_CATEGORIES.has(c)) throw createError({ statusCode: 400, statusMessage: 'Invalid category' })
    update.category = c
  }

	if (typeof body?.cve_ids !== 'undefined') update.cve_ids = normalizeFocusStringArray(body.cve_ids, 50, 30)
	if (typeof body?.affected_products !== 'undefined') update.affected_products = normalizeFocusStringArray(body.affected_products, 50, 120)
  if (typeof body?.article_ids !== 'undefined') update.article_ids = normalizeUuidArray(body.article_ids, 50)
	if (typeof body?.source_urls !== 'undefined') update.source_urls = normalizeFocusStringArray(body.source_urls, 50, 600)

  if (typeof body?.action_required !== 'undefined') update.action_required = cleanOptionalText(body.action_required, 4000)
  if (typeof body?.ioc_summary !== 'undefined') update.ioc_summary = cleanOptionalText(body.ioc_summary, 4000)

  let nextStatus: string | null = null
  if (typeof body?.status !== 'undefined') {
    const st = typeof body.status === 'string' ? body.status.trim().toLowerCase() : ''
    if (!VALID_FOCUS_STATUSES.has(st)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    update.status = st
    nextStatus = st
  }

  // Allow updating slug (optional), with normalization + dedup.
  if (typeof body?.slug !== 'undefined') {
    const raw = typeof body.slug === 'string' ? body.slug.trim() : ''
    if (!raw) throw createError({ statusCode: 400, statusMessage: 'Invalid slug' })
		const base = generateFocusSlug(raw)
    const currentSlug = (existingRes.data as unknown as { slug?: string | null }).slug ?? null
    if (base && base !== currentSlug) {
      update.slug = await findUniqueFocusSlug(supabase, base)
    }
  }

  if (typeof body?.expires_at !== 'undefined') {
    if (body.expires_at === null) update.expires_at = null
    else if (typeof body.expires_at === 'string') update.expires_at = body.expires_at.trim() || null
    else throw createError({ statusCode: 400, statusMessage: 'Invalid expires_at' })
  }

  // If status changes to active and expires_at is null or in the past, force 48h expiry.
  const prevStatus = (existingRes.data as unknown as { status?: string | null }).status ?? null
  if (nextStatus === 'active' && prevStatus !== 'active') {
    const prevExpires = (existingRes.data as unknown as { expires_at?: string | null }).expires_at ?? null
    const candidateExpires = (typeof update.expires_at === 'string' || update.expires_at === null) ? (update.expires_at as string | null) : prevExpires
    const now = Date.now()
    const expiryMs = candidateExpires ? Date.parse(candidateExpires) : NaN
    if (!candidateExpires || !Number.isFinite(expiryMs) || expiryMs <= now) {
      update.expires_at = new Date(now + 48 * 60 * 60 * 1000).toISOString()
    }
  }

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No updates provided' })
  }

  const { data, error } = await supabase.from('focus_items').update(update).eq('id', id).select('*').single()
  if (error) {
    console.error('[admin/focus/[id].patch] DB error (update):', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  try {
    const hydrated = await attachArticlesToFocusItems(supabase, [data] as unknown as Array<{ article_ids?: unknown }>)
    return { item: hydrated[0] }
  } catch (e) {
    console.error('[admin/focus/[id].patch] article join error:', e instanceof Error ? e.message : String(e))
    return { item: { ...data, articles: [] } }
  }
})
