import { createError, defineEventHandler, getRouterParam } from 'h3'

import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { useSupabaseAdmin } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`articles:by-slug:${ip}`, 120, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const slug = (getRouterParam(event, 'slug') || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!slugRegex.test(slug) || slug.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid slug' })
  }

  const supabase = useSupabaseAdmin()

  const selectFields = [
    'id',
    'title',
    'slug',
    'summary',
    'ai_summary',
    'brief',
    'full_text',
    'url',
    'image_url',
    'published_at',
    'ingested_at',
    'relevance_score',
    'entities',
    'category_id',
    'category:categories!articles_category_id_fkey(id,name,slug,icon)',
    'article_tags(category:categories!article_tags_category_id_fkey(id,name,slug,icon))'
  ].join(',')

  const { data: article, error } = await supabase
    .from('articles')
    .select(selectFields)
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()

  if (error) {
    console.error('[articles/[slug].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const articleId = (article as Record<string, unknown>).id
  if (typeof articleId !== 'string' || !articleId) {
    console.error('[articles/[slug].get] Missing article id in DB response')
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const { data: iocs, error: iocsError } = await supabase
    .from('article_iocs')
    .select('type,value,context')
    .eq('article_id', articleId)
    .limit(50)

  if (iocsError) {
    console.error('[articles/[slug].get] DB error (iocs):', iocsError.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { article, iocs: iocs ?? [] }
})
