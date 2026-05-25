import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../utils/rateLimit'

type LegalQuery = {
  limit?: string
  offset?: string
  jurisdiction?: string
  regulation?: string
  from?: string
  to?: string
}

function normalizeTextParam(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Strip basic HTML tags (defense-in-depth; dropdowns should send plain text).
  const clean = trimmed.replace(/<[^>]*>/g, '').trim()
  if (!clean) return null
  if (clean.length > maxLen) {
    throw createError({ statusCode: 400, statusMessage: 'Filter value too long' })
  }
  return clean
}

function normalizeDateParam(name: 'from' | 'to', value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Allow full ISO (YYYY-MM-DDTHH:MM:SSZ) by taking the YYYY-MM-DD prefix.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
  if (!m) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${name} date` })
  }
  return m[1]
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`legal:${ip}`, 60, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const query = getQuery<LegalQuery>(event)

  const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 100)
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0)

  const jurisdiction = normalizeTextParam(query.jurisdiction, 80)
  const regulation = normalizeTextParam(query.regulation, 80)
  const from = normalizeDateParam('from', query.from)
  const to = normalizeDateParam('to', query.to)

  const legalSlugs = [
    'gdpr',
    'ccpa-cpra',
    'hipaa',
    'nis2',
    'pci-dss',
    'dora',
    'privacy-fines',
    'uk-data-protection',
    'compliance',
    'privacy',
    'policy'
  ]

  const { data: cats, error: catsErr } = await supabase
    .from('categories')
    .select('id')
    .in('slug', legalSlugs)

  if (catsErr) {
    console.error('[legal.get] DB error:', catsErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const catIds = (cats || []).map((c) => c.id).filter(Boolean)

  const selectFields = [
    'id',
    'title',
    'brief',
    'url',
    'jurisdiction',
    'regulation',
    'fine_amount',
    'published_at',
    'ingested_at',
    'source:sources(id,name,url)',
    'category:categories!articles_category_id_fkey(id,name,slug)'
  ].join(',')

  const orCondition = catIds.length
    ? `category_id.in.(${catIds.join(',')}),jurisdiction.not.is.null,regulation.not.is.null`
    : 'jurisdiction.not.is.null,regulation.not.is.null'

  let db = supabase
    .from('articles')
    .select(selectFields)
    .eq('status', 'approved')
    .or(orCondition)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })

  if (jurisdiction) {
    db = db.ilike('jurisdiction', jurisdiction)
  }
  if (regulation) {
    db = db.ilike('regulation', regulation)
  }
  if (from) {
    db = db.gte('published_at', from)
  }
  if (to) {
    db = db.lte('published_at', to)
  }

  const { data, error } = await db.range(offset, offset + limit - 1)

  if (error) {
    console.error('[legal.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Distinct filter values for dropdowns.
  const { data: jurisdictions, error: jurisErr } = await supabase
    .from('articles')
    .select('jurisdiction')
    .not('jurisdiction', 'is', null)
    .eq('status', 'approved')
    .order('jurisdiction')

  if (jurisErr) {
    console.error('[legal.get] DB error:', jurisErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const { data: regulations, error: regErr } = await supabase
    .from('articles')
    .select('regulation')
    .not('regulation', 'is', null)
    .eq('status', 'approved')
    .order('regulation')

  if (regErr) {
    console.error('[legal.get] DB error:', regErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const uniqueJurisdictions = [
    ...new Set((jurisdictions || []).map((r) => r.jurisdiction).filter(Boolean))
  ]
  const uniqueRegulations = [...new Set((regulations || []).map((r) => r.regulation).filter(Boolean))]

  const items = Array.isArray(data) ? data : []
  return {
    items,
    filters: {
      jurisdictions: uniqueJurisdictions,
      regulations: uniqueRegulations
    },
    nextOffset: offset + items.length,
    hasMore: items.length === limit
  }
})
