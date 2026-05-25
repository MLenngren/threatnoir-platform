import { createError, defineEventHandler, getRouterParam } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { checkRateLimit, getClientIP } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`weekly:by-slug:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const slug = (getRouterParam(event, 'slug') || '').trim().toLowerCase()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing roundup slug' })

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!slugRegex.test(slug) || slug.length > 40) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid roundup slug' })
  }

  const { data, error } = await supabase
    .from('weekly_roundups')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[weekly/[slug].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Roundup not found' })
  }

  return { roundup: data }
})
