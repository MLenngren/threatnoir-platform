import { createError, defineEventHandler } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type TipCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number | null
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('tip_categories')
    .select('id,name,slug,description,icon,color,sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('[tips/categories.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { items: (data ?? []) as TipCategory[] }
})
