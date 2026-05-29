import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { getSiteConfig } from '../../utils/siteConfig'
import { getFeedMetadata } from '../../utils/feedConfig'

type FocusRow = {
  id: string
  title: string | null
  summary: string | null
  severity: string | null
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

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
	  const site = getSiteConfig()
  const siteUrl = normalizeSiteUrl()

  const { data, error } = await supabase
    .from('focus_items')
    .select('id,title,summary,severity,created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[focus/feed.xml] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (data ?? []) as FocusRow[]
  const mostRecent = rows[0]?.created_at
  const lastBuildDate = new Date(mostRecent || new Date().toISOString()).toUTCString()

  const items = rows
    .map((f) => {
      const link = `${siteUrl}/focus`
      const pub = new Date(f.created_at)
	      const title = (f.title || '').trim() || `${site.name} Focus Item`
      const description = (f.summary || '').trim()
      const severity = (f.severity || '').trim().toLowerCase() || 'medium'

      return `    <item>
      <title>${escXml(title)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="false">${escXml(f.id)}</guid>
      <pubDate>${pub.toUTCString()}</pubDate>
      <description>${wrapCdata(description)}</description>
      <category>${escXml(severity)}</category>
    </item>`
    })
    .join('\n')

  const meta = getFeedMetadata()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
	    <title>${site.name} — Active Focus Items</title>
    <link>${escXml(siteUrl)}</link>
	    <description>${wrapCdata('Curated cybersecurity news and analysis')}</description>
    <language>${escXml(meta.language)}</language>
    <copyright>${escXml(meta.copyright)}</copyright>
    <atom:link href="${escXml(`${siteUrl}/api/focus/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})
