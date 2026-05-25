import { createError, defineEventHandler, getQuery } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type TipsQuery = {
  category?: string
  search?: string
  limit?: string
  offset?: string
}

type TipCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
}

type TipItem = {
  id: string
  title: string
  body: string
  tags: string[]
  author_name: string
  featured: boolean
  created_at: string
  updated_at: string
  category: TipCategory | null
}

function clampInt(v: unknown, def: number, min: number, max: number) {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : def
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, n))
}

function cleanText(v: unknown, maxLen: number) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<TipsQuery>(event)

  const categorySlug = cleanText(query.category, 80)
  const search = cleanText(query.search, 120)
  const limit = clampInt(query.limit, 100, 1, 200)
  const offset = clampInt(query.offset, 0, 0, 50_000)

  let categoryId: string | null = null
  if (categorySlug) {
    const catRes = await supabase
      .from('tip_categories')
      .select('id')
      .eq('slug', categorySlug)
      .maybeSingle<{ id: string }>()

    if (catRes.error) {
      console.error('[tips/index.get] DB error (category lookup):', catRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    if (!catRes.data?.id) {
      return { items: [] as TipItem[] }
    }

    categoryId = catRes.data.id
  }

  const selectFields = [
    'id',
    'title',
    'body',
    'tags',
    'author_name',
    'featured',
    'created_at',
    'updated_at',
    'category:tip_categories!tips_category_id_fkey(id,name,slug,description,icon,color)'
  ].join(',')

  let tipsQuery = supabase
    .from('tips')
    .select(selectFields)
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (categoryId) {
    tipsQuery = tipsQuery.eq('category_id', categoryId)
  }

  if (search) {
    const s = search.replace(/\s+/g, ' ').trim()
    if (s.length >= 2) {
      // PostgREST OR filter: comma-separated expressions
      tipsQuery = tipsQuery.or(`title.ilike.%${s}%,body.ilike.%${s}%,author_name.ilike.%${s}%`)
    }
  }

  const { data, error } = await tipsQuery
  if (error) {
    console.error('[tips/index.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: (data ?? []) as TipItem[] }
})
