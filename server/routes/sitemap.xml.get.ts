import { defineEventHandler, setResponseHeader } from 'h3'

import { DEFAULT_SITE_URL } from '../../shared/siteDefaults'
import { useSupabaseAdmin } from '../utils/supabase'

type ChangeFreq = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

type UrlEntry = {
  loc: string
  lastmod: string
  changefreq: ChangeFreq
  priority: number
}

const MAX_URLS = 50_000

const escXml = (s: string) => {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const toIsoOrNow = (value: unknown, nowIso: string) => {
  if (typeof value !== 'string' || !value.trim()) return nowIso
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return nowIso
  return d.toISOString()
}

const normalizeBaseUrl = () => {
  const raw = (process.env.NUXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL
  return raw.replace(/\/$/, '')
}

const joinUrl = (baseUrl: string, path: string) => {
  if (!path.startsWith('/')) return `${baseUrl}/${path}`
  return `${baseUrl}${path}`
}

const pickContentChangefreq = (lastmodIso: string): ChangeFreq => {
  // Default: monthly. If recently updated, crawl more often.
  const ts = new Date(lastmodIso).getTime()
  if (!Number.isFinite(ts)) return 'monthly'
  const ageMs = Date.now() - ts
  if (ageMs <= 24 * 60 * 60 * 1000) return 'daily'
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) return 'weekly'
  return 'monthly'
}

export default defineEventHandler(async (event) => {
  const baseUrl = normalizeBaseUrl()
  const nowIso = new Date().toISOString()

  const staticPages: Array<{ path: string; changefreq: ChangeFreq; priority: number }> = [
    { path: '/', changefreq: 'hourly', priority: 1.0 },
    { path: '/feed', changefreq: 'hourly', priority: 0.9 },

	    // Persona landing pages
	    { path: '/for-soc', changefreq: 'weekly', priority: 0.8 },
	    { path: '/for-leaders', changefreq: 'weekly', priority: 0.8 },
	    { path: '/for-learners', changefreq: 'weekly', priority: 0.8 },
	    { path: '/for-developers', changefreq: 'weekly', priority: 0.8 },

	    // RSS feeds (API endpoints)
	    { path: '/api/feed.xml', changefreq: 'hourly', priority: 0.8 },
	    { path: '/api/articles/feed.xml', changefreq: 'hourly', priority: 0.7 },
	    { path: '/api/awareness/feed.xml', changefreq: 'hourly', priority: 0.6 },
	    { path: '/api/focus/feed.xml', changefreq: 'hourly', priority: 0.6 },
	    { path: '/api/podcast/feed.xml', changefreq: 'daily', priority: 0.7 },
	    { path: '/api/show/feed.xml', changefreq: 'daily', priority: 0.7 },
	    { path: '/api/weekly/feed.xml', changefreq: 'daily', priority: 0.7 },

    { path: '/iocs', changefreq: 'yearly', priority: 0.7 },
    { path: '/podcast', changefreq: 'daily', priority: 0.9 },
    { path: '/podcast/archive', changefreq: 'yearly', priority: 0.7 },
	    { path: '/show', changefreq: 'daily', priority: 0.8 },
    { path: '/weekly', changefreq: 'daily', priority: 0.9 },
    { path: '/awareness', changefreq: 'yearly', priority: 0.9 },
    { path: '/events', changefreq: 'yearly', priority: 0.7 },
    { path: '/focus', changefreq: 'yearly', priority: 0.7 },
    { path: '/tips', changefreq: 'yearly', priority: 0.7 },
    { path: '/resources', changefreq: 'yearly', priority: 0.7 },
    { path: '/developer', changefreq: 'yearly', priority: 0.7 },
    { path: '/review', changefreq: 'yearly', priority: 0.7 },

    { path: '/contact', changefreq: 'yearly', priority: 0.3 },
    { path: '/legal', changefreq: 'yearly', priority: 0.3 },
    { path: '/subscribe', changefreq: 'yearly', priority: 0.3 },
    { path: '/auth/signup', changefreq: 'yearly', priority: 0.3 },
    { path: '/auth/login', changefreq: 'yearly', priority: 0.3 }
  ]

  const urls: UrlEntry[] = []
  const seen = new Set<string>()

  const addUrl = (entry: UrlEntry) => {
    if (urls.length >= MAX_URLS) return
    if (!entry?.loc) return
    if (seen.has(entry.loc)) return
    seen.add(entry.loc)
    urls.push(entry)
  }

  for (const p of staticPages) {
    addUrl({
      loc: joinUrl(baseUrl, p.path),
      lastmod: nowIso,
      changefreq: p.changefreq,
      priority: p.priority
    })
  }

  let supabase: ReturnType<typeof useSupabaseAdmin> | null = null
  try {
    supabase = useSupabaseAdmin()
  } catch (e) {
    console.error('[sitemap.xml] Supabase admin client unavailable:', e)
  }

  if (supabase) {
	  // tag/{slug}
	  try {
	    function extractCount(v: unknown): number {
	      const first = Array.isArray(v) ? v[0] : v
	      if (!first || typeof first !== 'object') return 0
	      const countRaw = (first as Record<string, unknown>).count
	      const n = typeof countRaw === 'number' ? countRaw : Number(countRaw)
	      return Number.isFinite(n) ? n : 0
	    }

	    const { data, error } = await supabase
	      .from('categories')
	      .select('slug,article_tags(count)')
	      .order('slug', { ascending: true })
	      .limit(10_000)

	    if (error) throw error

	    const rows = (data ?? []) as Array<Record<string, unknown>>
	    const tagCounts = rows
	      .map((row) => {
	        const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
	        const count = extractCount(row.article_tags)
	        return { slug, count }
	      })
	      .filter((r) => !!r.slug)

	    const popular = new Set(
	      [...tagCounts]
	        .sort((a, b) => (b.count || 0) - (a.count || 0))
	        .slice(0, 50)
	        .map((r) => r.slug)
	    )

	    for (const row of tagCounts) {
	      const priority = popular.has(row.slug) ? 0.7 : 0.5
	      addUrl({
	        loc: joinUrl(baseUrl, `/tag/${encodeURIComponent(row.slug)}`),
	        lastmod: nowIso,
	        changefreq: 'weekly',
	        priority
	      })
	    }
	  } catch (e) {
	    console.error('[sitemap.xml] categories/tag pages query failed:', e)
	  }

    // weekly/{slug}
    try {
      const { data, error } = await supabase
        .from('weekly_roundups')
        .select('slug,updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(10_000)

      if (error) throw error
      for (const row of data ?? []) {
        const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
        if (!slug) continue
        const lastmod = toIsoOrNow(row.updated_at, nowIso)
        addUrl({
          loc: joinUrl(baseUrl, `/weekly/${encodeURIComponent(slug)}`),
          lastmod,
          changefreq: pickContentChangefreq(lastmod),
          priority: 0.8
        })
      }
    } catch (e) {
      console.error('[sitemap.xml] weekly_roundups query failed:', e)
    }

    // awareness/{slug}
    try {
      const { data, error } = await supabase
        .from('awareness_lessons')
        .select('slug,updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(10_000)

      if (error) throw error
      for (const row of data ?? []) {
        const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
        if (!slug) continue
        const lastmod = toIsoOrNow(row.updated_at, nowIso)
        addUrl({
          loc: joinUrl(baseUrl, `/awareness/${encodeURIComponent(slug)}`),
          lastmod,
          changefreq: pickContentChangefreq(lastmod),
          priority: 0.8
        })
      }
    } catch (e) {
      console.error('[sitemap.xml] awareness_lessons query failed:', e)
    }

    // focus/{slug}
    try {
      const { data, error } = await supabase
        .from('focus_items')
        .select('slug,updated_at')
        .in('status', ['active', 'archived'])
        .order('updated_at', { ascending: false })
        .limit(10_000)

      if (error) throw error
      for (const row of data ?? []) {
        const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
        if (!slug) continue
        const lastmod = toIsoOrNow(row.updated_at, nowIso)
        addUrl({
          loc: joinUrl(baseUrl, `/focus/${encodeURIComponent(slug)}`),
          lastmod,
          changefreq: pickContentChangefreq(lastmod),
          priority: 0.8
        })
      }
    } catch (e) {
      console.error('[sitemap.xml] focus_items query failed:', e)
    }

    // events/{slug}
    try {
      const { data, error } = await supabase
        .from('events')
        .select('slug,updated_at')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(10_000)

      if (error) throw error
      for (const row of data ?? []) {
        const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
        if (!slug) continue
        const lastmod = toIsoOrNow(row.updated_at, nowIso)
        addUrl({
          loc: joinUrl(baseUrl, `/events/${encodeURIComponent(slug)}`),
          lastmod,
          changefreq: pickContentChangefreq(lastmod),
          priority: 0.6
        })
      }
    } catch (e) {
      console.error('[sitemap.xml] events query failed:', e)
    }

    // tips/{id}
    try {
      const { data, error } = await supabase
        .from('tips')
        .select('id,updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(10_000)

      if (error) throw error
      for (const row of data ?? []) {
        const id = typeof row.id === 'string' ? row.id.trim() : ''
        if (!id) continue
        const lastmod = toIsoOrNow(row.updated_at, nowIso)
        addUrl({
          loc: joinUrl(baseUrl, `/tips/${encodeURIComponent(id)}`),
          lastmod,
          changefreq: pickContentChangefreq(lastmod),
          priority: 0.6
        })
      }
    } catch (e) {
      console.error('[sitemap.xml] tips query failed:', e)
    }

	    // show/{slug}
	    try {
	      type ShowSitemapRow = { slug: string | null; updated_at: string | null; date: string | null }
	      const { data, error } = await supabase
	        .from('video_briefings')
	        .select('slug,updated_at,date')
	        .not('slug', 'is', null)
	        .order('date', { ascending: false })
	        .limit(10_000)

	      if (error) throw error
	      for (const row of (data ?? []) as ShowSitemapRow[]) {
	        const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
	        if (!slug) continue
	        const lastmod = toIsoOrNow(row.updated_at || row.date, nowIso)
	        addUrl({
	          loc: joinUrl(baseUrl, `/show/${encodeURIComponent(slug)}`),
	          lastmod,
	          changefreq: pickContentChangefreq(lastmod),
	          priority: 0.8
	        })
	      }
	    } catch (e) {
	      console.error('[sitemap.xml] video_briefings show pages query failed:', e)
	    }

	    // article/{slug} (recent only)
	    try {
	      type ArticleSitemapRow = {
	        slug: string | null
	        updated_at: string | null
	        published_at: string | null
	        ingested_at: string | null
	      }

	      const cutoffIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
	      const { data, error } = await supabase
	        .from('articles')
	        .select('slug,updated_at,published_at,ingested_at')
	        .eq('status', 'approved')
	        .not('slug', 'is', null)
	        .gte('ingested_at', cutoffIso)
	        .order('ingested_at', { ascending: false })
	        .limit(10_000)

	      if (error) throw error
	      for (const row of (data ?? []) as ArticleSitemapRow[]) {
	        const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
	        if (!slug) continue
	        const lastmod = toIsoOrNow(row.updated_at || row.published_at || row.ingested_at, nowIso)
	        addUrl({
	          loc: joinUrl(baseUrl, `/article/${encodeURIComponent(slug)}`),
	          lastmod,
	          changefreq: pickContentChangefreq(lastmod),
	          priority: 0.7
	        })
	      }
	    } catch (e) {
	      console.error('[sitemap.xml] articles query failed:', e)
	    }
  }

  const body = urls
    .slice(0, MAX_URLS)
    .map((u) => {
      return `  <url>\n` +
        `    <loc>${escXml(u.loc)}</loc>\n` +
        `    <lastmod>${escXml(u.lastmod)}</lastmod>\n` +
        `    <changefreq>${u.changefreq}</changefreq>\n` +
        `    <priority>${u.priority.toFixed(1)}</priority>\n` +
        `  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>`

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')

  return xml
})
