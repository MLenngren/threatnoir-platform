import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

type ArticleRow = {
  title: string | null
  slug: string | null
  brief: string | null
  published_at: string | null
  category: { name: string | null } | null
}

const escXml = (s: string) => {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const wrapCdata = (s: string) => {
  // Prevent closing the CDATA section if content contains "]]>").
  const safe = s.replace(/\]\]>/g, ']]]]><![CDATA[>')
  return `<![CDATA[${safe}]]>`
}

const normalizeSiteUrl = () => {
  const raw = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').trim() || 'https://threatnoir.com'
  return raw.replace(/\/$/, '')
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const siteUrl = normalizeSiteUrl()

  const { data, error } = await supabase
    .from('articles')
    .select('title,slug,brief,published_at,category:categories!articles_category_id_fkey(name)')
    .eq('status', 'approved')
    .not('slug', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(50)

  if (error) {
    console.error('[articles/feed.xml] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (data ?? []) as ArticleRow[]
  const mostRecent = rows[0]?.published_at
  const lastBuildDate = new Date(mostRecent || new Date().toISOString()).toUTCString()

  const items = rows
    .map((a) => {
      const slug = (a.slug || '').trim()
      if (!slug) return ''

      const link = `${siteUrl}/article/${encodeURIComponent(slug)}`
      const pub = new Date(a.published_at || new Date().toISOString())
      const cat = (a.category?.name || '').trim()
      const description = (a.brief || '').trim()

      return `    <item>
      <title>${escXml((a.title || '').trim() || 'ThreatNoir Article')}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="true">${escXml(link)}</guid>
      <pubDate>${pub.toUTCString()}</pubDate>
      <description>${wrapCdata(description)}</description>${cat ? `\n      <category>${escXml(cat)}</category>` : ''}
    </item>`
    })
    .filter(Boolean)
    .join('\n')

  const year = new Date().getFullYear()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ThreatNoir — Security Articles</title>
    <link>${escXml(siteUrl)}</link>
    <description>${wrapCdata('Curated cybersecurity news and analysis')}</description>
    <language>en</language>
    <copyright>ThreatNoir ${year}</copyright>
    <atom:link href="${escXml(`${siteUrl}/api/articles/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})
