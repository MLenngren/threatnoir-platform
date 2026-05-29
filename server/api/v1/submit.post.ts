import { serverSupabaseServiceRole } from '#supabase/server'
import { defineEventHandler, getHeader, readBody, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'

import { validateApiKey } from '../../utils/apiKey'
import { fetchUrlMeta } from '../../utils/fetchMeta'
import { generateArticleSlug } from '../../utils/slugify'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { getSiteConfig } from '../../utils/siteConfig'

type Body = {
  url?: string
  title?: string
  summary?: string
  category?: string
  source_name?: string
  auto_approve?: boolean
}

async function getOrCreateApiSource(supabase: SupabaseClient, args: { name: string; url: string }) {
  const { data: existing, error: existingError } = await supabase
    .from('sources')
    .select('id,name,url,type')
    .eq('type', 'api')
    .eq('name', args.name)
    .limit(1)
    .maybeSingle()

  if (existingError) {
		console.error('[v1/submit.post] DB error:', existingError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (existing?.id) return existing

  const { data: created, error: createdError } = await supabase
    .from('sources')
    .insert({ name: args.name, url: args.url, type: 'api', is_active: true })
    .select('id,name,url,type')
    .single()

  if (createdError) {
		console.error('[v1/submit.post] DB error:', createdError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return created
}

function extractApiKey(event: H3Event): string {
  const headerKey = getHeader(event, 'x-api-key')
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  return (headerKey || bearer || '').trim()
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`v1:submit:${ip}`, 10, 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const key = extractApiKey(event)
  const authRes = validateApiKey(key)
  if (!authRes.valid || !authRes.scope) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const supabase = serverSupabaseServiceRole(event) as unknown as SupabaseClient
  const body = await readBody<Body>(event)

  const urlInput = (body?.url ?? '').trim()
  if (!urlInput) {
    throw createError({ statusCode: 400, statusMessage: 'Missing url field' })
  }

  let urlObj: URL
  try {
    urlObj = new URL(urlInput)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid url' })
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid url protocol' })
  }

  const url = urlObj.toString()

  // Deduplication by URL
  const existingRes = await supabase.from('articles').select('id,status,title,url').eq('url', url).maybeSingle()
  if (existingRes.error) {
		console.error('[v1/submit.post] DB error:', existingRes.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (existingRes.data) {
    setResponseStatus(event, 409)
    return existingRes.data
  }

  const categorySlug = (body?.category ?? '').trim() || null
  if (categorySlug && !/^[a-z0-9-]+$/.test(categorySlug)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category slug' })
  }

  let categoryId: string | null = null
  if (categorySlug) {
    const categoryRes = await supabase.from('categories').select('id').eq('slug', categorySlug).maybeSingle()
    if (categoryRes.error) {
			console.error('[v1/submit.post] DB error:', categoryRes.error.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    if (!categoryRes.data) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid category' })
    }
    categoryId = categoryRes.data.id
  }

  const sourceName = (body?.source_name ?? '').trim() || 'Manual / API'
	  const defaultSiteUrl = getSiteConfig().url
  const sourceUrl = (() => {
    try {
      return urlObj.origin
    } catch {
      return defaultSiteUrl
    }
  })()

  const source = await getOrCreateApiSource(supabase, { name: sourceName, url: sourceUrl })

  const titleOverride = (body?.title ?? '').trim() || null
  const summaryOverride = (body?.summary ?? '').trim() || null

  const shouldFetchMeta = !titleOverride || !summaryOverride

  let meta: Awaited<ReturnType<typeof fetchUrlMeta>> = {}
  if (shouldFetchMeta) {
    try {
      meta = await fetchUrlMeta(url)
    } catch (err: unknown) {
      const name = err && typeof err === 'object' ? (err as { name?: unknown }).name : undefined
      if (name === 'UrlBlockedError') {
        throw createError({ statusCode: 400, statusMessage: 'URL is not allowed' })
      }
      throw err
    }
  }

  const title = titleOverride || meta.title || url
  const summary = summaryOverride ?? meta.description ?? null
  const imageUrl = meta.image ?? null

  const wantsAutoApprove = Boolean(body?.auto_approve)
  const autoApprove = wantsAutoApprove && authRes.scope === 'admin'
  const status = autoApprove ? 'approved' : 'pending'
  const now = new Date().toISOString()

  const insertRes = await supabase
    .from('articles')
    .insert({
      title,
	      slug: generateArticleSlug(title, url),
      url,
      summary,
      image_url: imageUrl,
      source_id: source.id,
      category_id: categoryId,
      status,
      ingested_at: now,
      published_at: autoApprove ? now : null,
      submitted_via: 'api'
    })
    .select('id,status,title,url')
    .single()

  if (insertRes.error) {
    // Handle race: unique(url) violation
    if ((insertRes.error as { code?: string }).code === '23505') {
      const dupRes = await supabase.from('articles').select('id,status,title,url').eq('url', url).maybeSingle()
      if (dupRes.data) {
        setResponseStatus(event, 409)
        return dupRes.data
      }
    }

		console.error('[v1/submit.post] DB error:', insertRes.error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  setResponseStatus(event, 201)
  return insertRes.data
})
