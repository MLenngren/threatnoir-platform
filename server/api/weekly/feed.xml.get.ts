import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'
import { getSiteConfig } from '../../utils/siteConfig'

type RoundupRow = {
  week_label: string
  slug: string
  date_from: string
  date_to: string
  tldr: string | null
  full_brief: string
  created_at: string
  published_at: string | null
}

const escXml = (s: string) => {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const stripMarkdownToExcerpt = (input: string, maxLen = 280) => {
  const cleaned = input
    .replace(/^#+ .*/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()

  const sliced = cleaned.slice(0, maxLen)
  if (cleaned.length > maxLen) return `${sliced}...`
  return sliced
}

export default defineEventHandler(async (event) => {
	const site = getSiteConfig()
  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('weekly_roundups')
    .select('week_label,slug,date_from,date_to,tldr,full_brief,created_at,published_at')
    .eq('status', 'published')
    .order('date_from', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[weekly/feed.xml] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items = ((data ?? []) as RoundupRow[])
    .map((r) => {
	    const link = `${site.url}/weekly/${encodeURIComponent(r.slug)}`
      const pub = new Date(r.published_at || r.created_at)
      const title = `Weekly Threat Roundup ${r.week_label} (${r.date_from} to ${r.date_to})`
      const description = stripMarkdownToExcerpt(r.tldr || r.full_brief || '', 300)

      return `    <item>
      <title>${escXml(title)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="false">${escXml(r.week_label)}</guid>
      <pubDate>${pub.toUTCString()}</pubDate>
      <description>${escXml(description)}</description>
    </item>`
    })
    .join('\n')

  const year = new Date().getFullYear()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
	    <title>${site.name} — Weekly Threat Roundup</title>
	    <link>${site.url}/weekly</link>
	    <description>Weekly threat intelligence roundup curated for practitioners. Drafted by AI, reviewed by ${site.name}.</description>
    <language>en</language>
    <copyright>ThreatNoir ${year}</copyright>
	    <atom:link href="${site.url}/api/weekly/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=900')
  return xml
})
