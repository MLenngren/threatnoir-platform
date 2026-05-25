import { createError, defineEventHandler, getRouterParam } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { checkRateLimit, getClientIP } from '../../../utils/rateLimit'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`show:episodes:by-slug:${ip}`, 30, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const slug = (getRouterParam(event, 'slug') || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing episode slug' })
  if (!SLUG_REGEX.test(slug) || slug.length > 140) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid episode slug' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('video_briefings')
    .select('id,slug,summary,date,title,duration_seconds,video_url,thumbnail_url,script,created_at,updated_at')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('[show/episodes/[slug].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Episode not found' })
  }

  return { episode: data }
})
