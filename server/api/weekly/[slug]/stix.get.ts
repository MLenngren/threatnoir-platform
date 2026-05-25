import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { randomUUID } from 'node:crypto'

import { serverSupabaseServiceRole } from '#supabase/server'

import { checkRateLimit, getClientIP } from '../../../utils/rateLimit'

type TopIoc = { type: string; value: string; context?: string }

type IndicatorObject = {
  type: 'indicator'
  spec_version: '2.1'
  id: string
  created: string
  modified: string
  name: string
  description?: string
  pattern: string
  pattern_type: 'stix'
  valid_from: string
}

type MalwareObject = {
  type: 'malware'
  spec_version: '2.1'
  id: string
  created: string
  modified: string
  name: string
  description?: string
  is_family: boolean
}

type StixBundle = {
  type: 'bundle'
  id: string
  objects: Array<IndicatorObject | MalwareObject>
}

function safeFilenamePiece(v: string) {
  return (v || 'weekly')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase()
}

function escapePatternValue(v: string) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function validFrom(dateFrom: string | null | undefined, fallbackIso: string) {
  if (typeof dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    const iso = new Date(`${dateFrom}T00:00:00.000Z`).toISOString()
    return iso
  }
  return fallbackIso
}

function toStixObject(ioc: TopIoc, opts: { createdIso: string; validFromIso: string }): IndicatorObject | MalwareObject | null {
  const type = (ioc.type || '').trim().toLowerCase()
  const value = (ioc.value || '').trim()
  const description = (ioc.context || '').trim() || undefined
  if (!type || !value) return null

  const id = randomUUID()

  if (type === 'malware') {
    return {
      type: 'malware',
      spec_version: '2.1',
      id: `malware--${id}`,
      created: opts.createdIso,
      modified: opts.createdIso,
      name: value,
      ...(description ? { description } : {}),
      is_family: false
    }
  }

  const v = escapePatternValue(value)
  let pattern: string | null = null

  if (type === 'ip') {
    const isV6 = value.includes(':')
    pattern = isV6 ? `[ipv6-addr:value = '${v}']` : `[ipv4-addr:value = '${v}']`
  } else if (type === 'domain') {
    pattern = `[domain-name:value = '${v}']`
  } else if (type === 'url') {
    pattern = `[url:value = '${v}']`
  } else if (type === 'hash_md5') {
    pattern = `[file:hashes.'MD5' = '${v}']`
  } else if (type === 'hash_sha1') {
    pattern = `[file:hashes.'SHA-1' = '${v}']`
  } else if (type === 'hash_sha256') {
    pattern = `[file:hashes.'SHA-256' = '${v}']`
  } else if (type === 'email') {
    pattern = `[email-addr:value = '${v}']`
  } else if (type === 'cve') {
    // CVEs are not strict SCOs, but we still export as an indicator via the canonical NVD URL.
    const nvd = escapePatternValue(`https://nvd.nist.gov/vuln/detail/${value}`)
    pattern = `[url:value = '${nvd}']`
  } else {
    return null
  }

  if (!pattern) return null

  return {
    type: 'indicator',
    spec_version: '2.1',
    id: `indicator--${id}`,
    created: opts.createdIso,
    modified: opts.createdIso,
    name: value,
    ...(description ? { description } : {}),
    pattern,
    pattern_type: 'stix',
    valid_from: opts.validFromIso
  }
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`weekly:stix:${ip}`, 60, 60_000)
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
    .select('week_label,slug,date_from,top_iocs,created_at,published_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[weekly/[slug]/stix.get] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Roundup not found' })
  }

  const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const topIocsRaw = rec.top_iocs
  const topIocs = Array.isArray(topIocsRaw) ? (topIocsRaw as Array<Record<string, unknown>>) : []

  const createdIso = new Date(String(rec.published_at || rec.created_at || new Date().toISOString())).toISOString()
  const validFromIso = validFrom(typeof rec.date_from === 'string' ? rec.date_from : null, createdIso)

  const objects: Array<IndicatorObject | MalwareObject> = []
  for (const row of topIocs) {
    const obj = toStixObject(
      {
        type: typeof row.type === 'string' ? row.type : '',
        value: typeof row.value === 'string' ? row.value : '',
        context: typeof row.context === 'string' ? row.context : undefined
      },
      { createdIso, validFromIso }
    )
    if (obj) objects.push(obj)
  }

  const weekLabel = typeof rec.week_label === 'string' ? rec.week_label : 'weekly'
  const filename = `threatnoir-${safeFilenamePiece(weekLabel)}.stix.json`

  const bundle: StixBundle = {
    type: 'bundle',
    id: `bundle--${randomUUID()}`,
    objects
  }

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

  return bundle
})
