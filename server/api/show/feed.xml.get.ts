import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { getSiteConfig } from '../../utils/siteConfig'
import { getFeedMetadata } from '../../utils/feedConfig'

type ShowEpisodeRow = {
  date: string
  slug: string | null
  title: string | null
  summary: string | null
  duration_seconds: number | null
  video_url: string | null
  thumbnail_url: string | null
  updated_at: string
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

const contentTypeForVideoUrl = (url: string) => {
  const u = url.toLowerCase()
  if (u.endsWith('.mp4')) return 'video/mp4'
  if (u.endsWith('.webm')) return 'video/webm'
  if (u.endsWith('.mov')) return 'video/quicktime'
  return 'video/mp4'
}

export default defineEventHandler(async (event) => {
	  const site = getSiteConfig()
	  const siteUrl = normalizeSiteUrl()
  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('video_briefings')
    .select('date,slug,title,summary,duration_seconds,video_url,thumbnail_url,updated_at')
    .order('date', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[show/feed.xml] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (data ?? []) as ShowEpisodeRow[]
  const lastBuildDate = new Date(rows[0]?.updated_at || new Date().toISOString()).toUTCString()

  const items = rows
    .map((ep) => {
      const slug = (ep.slug || '').trim()
      if (!slug) return ''

      const link = `${siteUrl}/show/${encodeURIComponent(slug)}`
      const pub = new Date(ep.date)
      pub.setUTCHours(12, 0, 0, 0)

      const desc = (ep.summary || '').trim() || (ep.title || '').trim()
      const videoUrl = (ep.video_url || '').trim()
      const enclosure = videoUrl
        ? `\n      <enclosure url="${escXml(videoUrl)}" type="${escXml(contentTypeForVideoUrl(videoUrl))}"/>`
        : ''

      const thumbnail = (ep.thumbnail_url || '').trim()
      const mediaThumb = thumbnail ? `\n      <media:thumbnail url="${escXml(thumbnail)}"/>` : ''

      return `    <item>
      <title>${escXml((ep.title || '').trim() || 'Red vs Blue Show')}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="true">${escXml(link)}</guid>
      <pubDate>${pub.toUTCString()}</pubDate>
	      <description>${wrapCdata(desc)}</description>${enclosure}${mediaThumb}
    </item>`
    })
    .filter(Boolean)
    .join('\n')

  const meta = getFeedMetadata()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
	    <title>${site.name} — Red vs Blue Show</title>
    <link>${escXml(`${siteUrl}/show`)}</link>
    <description>${wrapCdata('Red team attacks, blue team defends. Tactical security breakdowns of real vulnerabilities.')}</description>
    <language>${escXml(meta.language)}</language>
    <copyright>${escXml(meta.copyright)}</copyright>
    <atom:link href="${escXml(`${siteUrl}/api/show/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})
