import { createError, defineEventHandler, getRouterParam } from 'h3'

import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { useSupabaseAdmin } from '../../utils/supabase'

type TagInfo = {
  slug: string
  name: string
  description: string | null
}

function isValidTagSlug(slug: string) {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  return slugRegex.test(slug) && slug.length <= 60
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function summarizeText(v: unknown, maxLen: number) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  const clean = s.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen).trim()}…`
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`tag:${ip}`, 120, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const rawSlug = (getRouterParam(event, 'slug') || '').trim().toLowerCase()
  if (!rawSlug) throw createError({ statusCode: 400, statusMessage: 'Missing tag slug' })
  if (!isValidTagSlug(rawSlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tag slug' })
  }

  const slug = rawSlug
  const supabase = useSupabaseAdmin()

  // Known article tag category
  const { data: category, error: categoryErr } = await supabase
    .from('categories')
    .select('id,name,slug,description')
    .eq('slug', slug)
    .maybeSingle()

  if (categoryErr) {
    console.error('[tag/[slug].get] DB error (categories):', categoryErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Known awareness tag (optional)
  const { data: awarenessTag, error: awarenessTagErr } = await supabase
    .from('awareness_tags')
    .select('id,name,slug,description')
    .eq('slug', slug)
    .maybeSingle()

  if (awarenessTagErr) {
    console.error('[tag/[slug].get] DB error (awareness_tags):', awarenessTagErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const tag: TagInfo = {
    slug,
    name:
      (typeof category?.name === 'string' && category.name.trim()) ||
      (typeof awarenessTag?.name === 'string' && awarenessTag.name.trim()) ||
      slug.replace(/-/g, ' '),
    description:
      (typeof category?.description === 'string' && category.description.trim())
        ? category.description.trim()
        : (typeof awarenessTag?.description === 'string' && awarenessTag.description.trim())
          ? awarenessTag.description.trim()
          : null
  }

  // Articles (via RPC used elsewhere for correct semantics)
  type ArticleItem = {
    id: string
    title: string
    slug: string | null
    brief: string | null
    ai_summary: string | null
    url: string
    image_url: string | null
    published_at: string | null
  }

  let articles: ArticleItem[] = []
  if (category?.id && typeof category.id === 'string') {
    const idsRes = await supabase.rpc('get_approved_article_ids', {
      p_category_id: null,
      p_tag_id: category.id,
      p_search: null,
      limit_count: 51,
      offset_count: 0
    })

    if (idsRes.error) {
      console.error('[tag/[slug].get] DB error (get_approved_article_ids):', idsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const ids = (Array.isArray(idsRes.data) ? idsRes.data : [])
      .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>).id : null))
      .filter((v): v is string => typeof v === 'string' && !!v)
      .slice(0, 50)

    if (ids.length) {
      const { data, error } = await supabase
        .from('articles')
        .select('id,title,slug,brief,ai_summary,url,image_url,published_at')
        .eq('status', 'approved')
        .in('id', ids)
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('ingested_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[tag/[slug].get] DB error (articles):', error.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }

      articles = (data ?? []) as ArticleItem[]
    }
  }

  // Awareness lessons (via awareness_tags -> awareness_lesson_tags junction)
  type AwarenessItem = {
    id: string
    title: string
    slug: string | null
    summary: string | null
    updated_at: string | null
    published_at: string | null
  }

  let awareness: AwarenessItem[] = []
  if (awarenessTag?.id && typeof awarenessTag.id === 'string') {
    const idsRes = await supabase
      .from('awareness_lesson_tags')
      .select('lesson_id')
      .eq('tag_id', awarenessTag.id)
      .limit(5000)

    if (idsRes.error) {
      console.error('[tag/[slug].get] DB error (awareness_lesson_tags):', idsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const lessonIds = (idsRes.data ?? [])
      .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>).lesson_id : null))
      .filter((v): v is string => typeof v === 'string' && !!v)

    if (lessonIds.length) {
      const { data, error } = await supabase
        .from('awareness_lessons')
        .select('id,title,slug,body,updated_at,published_at')
        .eq('status', 'published')
        .in('id', lessonIds.slice(0, 500))
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('[tag/[slug].get] DB error (awareness_lessons):', error.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }

      awareness = (data ?? []).map((row) => {
        const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
        return {
          id: String(rec.id || ''),
          title: typeof rec.title === 'string' ? rec.title : '',
          slug: typeof rec.slug === 'string' ? rec.slug : null,
          summary: summarizeText(rec.body, 180),
          updated_at: typeof rec.updated_at === 'string' ? rec.updated_at : null,
          published_at: typeof rec.published_at === 'string' ? rec.published_at : null
        }
      })
    }
  }

  // Events: tags array contains slug
  const sevenDaysAgoIso = toIsoDate(new Date(Date.now() - 7 * 86400000))
  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select('id,title,slug,description,url,start_date,end_date,location,is_virtual,category,tags')
    .eq('status', 'approved')
    .contains('tags', [slug])
    .gte('start_date', sevenDaysAgoIso)
    .order('start_date', { ascending: true })
    .limit(20)

  if (eventsErr) {
    console.error('[tag/[slug].get] DB error (events):', eventsErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Tips: tags array contains slug
  const { data: tips, error: tipsErr } = await supabase
    .from('tips')
    .select('id,title,body,tags,author_name,updated_at,created_at')
    .eq('status', 'published')
    .contains('tags', [slug])
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (tipsErr) {
    console.error('[tag/[slug].get] DB error (tips):', tipsErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Focus items: match affected_products (exact or substring)
  const focusSelect = [
    'id',
    'title',
    'slug',
    'summary',
    'severity',
    'category',
    'cve_ids',
    'affected_products',
    'status',
    'created_at',
    'updated_at'
  ].join(',')

  const { data: focusExact, error: focusExactErr } = await supabase
    .from('focus_items')
    .select(focusSelect)
    .in('status', ['active', 'archived'])
    .contains('affected_products', [slug])
    .order('created_at', { ascending: false })
    .limit(10)

  if (focusExactErr) {
    console.error('[tag/[slug].get] DB error (focus_items exact):', focusExactErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const byId = new Map<string, Record<string, unknown>>()
  for (const row of focusExact ?? []) {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : null
    const id = rec && typeof rec.id === 'string' ? rec.id : null
    if (id) byId.set(id, rec)
  }

  if (byId.size < 10) {
    const { data: focusRecent, error: focusRecentErr } = await supabase
      .from('focus_items')
      .select(focusSelect)
      .in('status', ['active', 'archived'])
      .order('created_at', { ascending: false })
      .limit(200)

    if (focusRecentErr) {
      console.error('[tag/[slug].get] DB error (focus_items recent):', focusRecentErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const needle = slug.toLowerCase()
    for (const row of focusRecent ?? []) {
      const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : null
      if (!rec) continue
      const id = typeof rec.id === 'string' ? rec.id : null
      if (!id || byId.has(id)) continue

      const products = Array.isArray(rec.affected_products) ? (rec.affected_products as unknown[]) : []
      const matches = products
        .map((p) => (typeof p === 'string' ? p.toLowerCase() : ''))
        .some((p) => !!p && (p === needle || p.includes(needle)))

      if (matches) {
        byId.set(id, rec)
        if (byId.size >= 10) break
      }
    }
  }

  const focus_items = Array.from(byId.values()).slice(0, 10)

  const total_count =
    articles.length +
    awareness.length +
    (events?.length ?? 0) +
    (tips?.length ?? 0) +
    focus_items.length

  if (total_count === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Tag not found' })
  }

  return {
    tag,
    articles,
    awareness,
    events: events ?? [],
    tips: tips ?? [],
    focus_items,
    total_count
  }
})
