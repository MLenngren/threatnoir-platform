import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { getSiteConfig } from '../../utils/siteConfig'
import { getFeedMetadata } from '../../utils/feedConfig'

type AwarenessRow = {
  title: string | null
  slug: string | null
  body: string | null
  created_at: string
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
  const safe = s.replace(/\]\]>/g, ']]]]><![CDATA[>')
  return `<![CDATA[${safe}]]>`
}

const normalizeSiteUrl = () => {
	  return getSiteConfig().url
}

const firstChars = (s: string, maxLen: number) => {
  const cleaned = s.trim()
  if (cleaned.length <= maxLen) return cleaned
  return `${cleaned.slice(0, maxLen)}...`
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
	  const site = getSiteConfig()
  const siteUrl = normalizeSiteUrl()

  const { data, error } = await supabase
    .from('awareness_lessons')
    .select('title,slug,body,created_at')
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[awareness/feed.xml] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (data ?? []) as AwarenessRow[]
  const mostRecent = rows[0]?.created_at
  const lastBuildDate = new Date(mostRecent || new Date().toISOString()).toUTCString()

  const items = rows
    .map((l) => {
      const slug = (l.slug || '').trim()
      if (!slug) return ''

      const link = `${siteUrl}/awareness/${encodeURIComponent(slug)}`
      const pub = new Date(l.created_at)
      const description = firstChars(l.body || '', 500)

      return `    <item>
	      <title>${escXml((l.title || '').trim() || `${site.name} Awareness Lesson`)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="true">${escXml(link)}</guid>
      <pubDate>${pub.toUTCString()}</pubDate>
      <description>${wrapCdata(description)}</description>
    </item>`
    })
    .filter(Boolean)
    .join('\n')

  const meta = getFeedMetadata()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
	    <title>${site.name} — Awareness Lessons</title>
    <link>${escXml(siteUrl)}</link>
	    <description>${wrapCdata('Curated cybersecurity news and analysis')}</description>
    <language>${escXml(meta.language)}</language>
    <copyright>${escXml(meta.copyright)}</copyright>
    <atom:link href="${escXml(`${siteUrl}/api/awareness/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})
