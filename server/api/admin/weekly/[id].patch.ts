import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'
import { UUID_REGEX } from '../../../utils/subscriptions'

type Body = {
  tldr?: unknown
  full_brief?: unknown
  top_iocs?: unknown
  awareness_links?: unknown
  social_linkedin?: unknown
  social_x?: unknown
  status?: unknown
}

const VALID_STATUS = new Set(['draft', 'published'])

function cleanNullableText(v: unknown, maxLen: number): string | null {
  if (v === null) return null
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

function normalizeIocs(v: unknown): Array<{ type: string; value: string; context?: string }> {
  if (!Array.isArray(v)) return []
  const out: Array<{ type: string; value: string; context?: string }> = []
  const seen = new Set<string>()
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const type = typeof rec.type === 'string' ? rec.type.trim() : ''
    const value = typeof rec.value === 'string' ? rec.value.trim() : ''
    const context = typeof rec.context === 'string' ? rec.context.trim() : ''
    if (!type || !value) continue
    const key = `${type}:${value}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      type: type.slice(0, 40),
      value: value.slice(0, 500),
      context: context ? context.slice(0, 500) : undefined
    })
    if (out.length >= 50) break
  }
  return out
}

function normalizeAwarenessLinks(v: unknown): Array<{ slug: string; title: string }> {
  if (!Array.isArray(v)) return []
  const out: Array<{ slug: string; title: string }> = []
  const seen = new Set<string>()
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const slug = typeof rec.slug === 'string' ? rec.slug.trim() : ''
    const title = typeof rec.title === 'string' ? rec.title.trim() : ''
    if (!slug || !title) continue
    if (!slugRegex.test(slug) || slug.length > 120) continue
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push({ slug, title: title.slice(0, 200) })
    if (out.length >= 50) break
  }
  return out
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid roundup id' })
  }

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}

  if ('tldr' in (body ?? {})) {
    patch.tldr = cleanNullableText(body?.tldr, 3000)
  }
  if ('full_brief' in (body ?? {})) {
    const fb = cleanNullableText(body?.full_brief, 80_000)
    if (fb === null) throw createError({ statusCode: 400, statusMessage: 'Missing full_brief' })
    patch.full_brief = fb
  }
  if ('social_linkedin' in (body ?? {})) {
    patch.social_linkedin = cleanNullableText(body?.social_linkedin, 2000)
  }
  if ('social_x' in (body ?? {})) {
    patch.social_x = cleanNullableText(body?.social_x, 600)
  }
  if ('top_iocs' in (body ?? {})) {
    patch.top_iocs = normalizeIocs(body?.top_iocs) as unknown
  }
  if ('awareness_links' in (body ?? {})) {
    patch.awareness_links = normalizeAwarenessLinks(body?.awareness_links) as unknown
  }

  let desiredStatus: 'draft' | 'published' | null = null
  if ('status' in (body ?? {})) {
    const s = typeof body?.status === 'string' ? body.status.trim() : ''
    if (!s || !VALID_STATUS.has(s)) throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    desiredStatus = s as 'draft' | 'published'
    patch.status = desiredStatus
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  // Publishing logic: preserve existing published_at when toggling to published.
  if (desiredStatus) {
    const { data: existing, error: readErr } = await supabase
      .from('weekly_roundups')
      .select('published_at')
      .eq('id', id)
      .maybeSingle()

    if (readErr) {
      console.error('[admin/weekly/[id].patch] DB error (read):', readErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Roundup not found' })
    }

    patch.published_at = desiredStatus === 'published' ? (existing.published_at || new Date().toISOString()) : null
  }

  const { data: updated, error } = await supabase
    .from('weekly_roundups')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[admin/weekly/[id].patch] DB error (update):', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Roundup not found' })
  }

  return { roundup: updated }
})
