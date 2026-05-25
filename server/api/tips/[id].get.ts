import { createError, defineEventHandler, getRouterParam } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { UUID_REGEX } from '../../utils/subscriptions'

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

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const id = (getRouterParam(event, 'id') || '').trim()

  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tip id' })
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

  const { data, error } = await supabase
    .from('tips')
    .select(selectFields)
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[tips/[id].get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Tip not found' })
  }

  return { tip: data as TipItem }
})
