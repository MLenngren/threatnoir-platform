import type { SupabaseClient } from '@supabase/supabase-js'

import { UUID_REGEX } from './subscriptions'

export const VALID_FOCUS_SEVERITIES = new Set(['critical', 'high', 'medium'])
export const VALID_FOCUS_CATEGORIES = new Set(['cve', 'breach', 'exploit', 'campaign', 'advisory'])
export const VALID_FOCUS_STATUSES = new Set(['pending', 'active', 'archived'])

export type FocusArticleLite = { id: string; title: string; url: string }

export function generateFocusSlug(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function findUniqueFocusSlug(supabase: SupabaseClient, base: string): Promise<string> {
  const safeBase = (base || '').trim() || `focus-${Date.now().toString(10)}`
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? safeBase : `${safeBase}-${i}`
    const check = await supabase.from('focus_items').select('id').eq('slug', candidate).maybeSingle()
    if (check.error) throw check.error
    if (!check.data) return candidate
  }
  return `${safeBase}-${Date.now().toString(10)}`
}

export function normalizeFocusStringArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .map((s) => (s.length <= maxLen ? s : s.slice(0, maxLen)))
    .slice(0, maxItems)
}

export function normalizeUuidArray(v: unknown, maxItems: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((s) => !!s && UUID_REGEX.test(s))
    .slice(0, maxItems)
}

export function cleanOptionalText(v: unknown, maxLen: number): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

export async function attachArticlesToFocusItems<T extends { article_ids?: unknown }>(
  supabase: SupabaseClient,
  items: T[]
): Promise<Array<T & { articles: FocusArticleLite[] }>> {
  const allIds: string[] = []
  for (const item of items ?? []) {
    const raw = (item as unknown as { article_ids?: unknown })?.article_ids
    const ids = Array.isArray(raw) ? (raw.filter((x) => typeof x === 'string') as string[]) : []
    for (const id of ids) {
      const trimmed = id.trim()
      if (UUID_REGEX.test(trimmed)) allIds.push(trimmed)
    }
  }

  const uniqueIds = Array.from(new Set(allIds))
  if (uniqueIds.length === 0) {
    return (items ?? []).map((i) => ({ ...i, articles: [] }))
  }

  const { data: articles, error } = await supabase.from('articles').select('id,title,url').in('id', uniqueIds)
  if (error) throw error

  const map = new Map<string, FocusArticleLite>()
  for (const a of (articles ?? []) as unknown as FocusArticleLite[]) {
    if (!a?.id) continue
    map.set(a.id, { id: a.id, title: a.title, url: a.url })
  }

  return (items ?? []).map((i) => {
    const raw = (i as unknown as { article_ids?: unknown })?.article_ids
    const ids = Array.isArray(raw) ? (raw.filter((x) => typeof x === 'string') as string[]) : []
    const linked = ids
      .map((id) => map.get(id.trim()))
      .filter(Boolean) as FocusArticleLite[]

    return { ...i, articles: linked }
  })
}
