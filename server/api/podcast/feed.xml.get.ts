import { defineEventHandler, setResponseHeader } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

type EpisodeRow = {
  date: string
  edition: string | null
  title: string | null
  duration_seconds: number | null
  audio_url: string | null
  article_count: number | null
  article_text: string | null
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

const formatItunesDuration = (durationSeconds: number) => {
  const safe = Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.floor(durationSeconds) : 0
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const stripMarkdownToExcerpt = (input: string, maxLen = 300) => {
  const cleaned = input
    .replace(/^#+ .*/gm, '') // strip markdown headings
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // strip markdown links
    .replace(/[*_`~]/g, '') // strip markdown formatting
    .replace(/\n+/g, ' ')
    .trim()

  const sliced = cleaned.slice(0, maxLen)
  if (cleaned.length > maxLen) return `${sliced}...`
  return sliced
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)

  const { data: episodes, error } = await supabase
    .from('podcast_episodes')
    .select('date, edition, title, duration_seconds, audio_url, article_count, article_text, created_at')
    .not('audio_url', 'is', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[podcast/feed.xml] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const eps = (episodes ?? []) as EpisodeRow[]

  const items = eps
    .map((ep, idx) => {
      const date = new Date(ep.date)
      const edition = ep.edition || 'morning'
      const isAfternoon = edition === 'afternoon'

      // Set pub time: morning=05:00 UTC, afternoon=15:00 UTC
      date.setUTCHours(isAfternoon ? 15 : 5, 0, 0, 0)

      const guid = `${ep.date}-${edition}`

      let description = (ep.title || '').trim()
      if (ep.article_text) {
        description = stripMarkdownToExcerpt(ep.article_text, 300) || description
      }

      const durationFormatted = formatItunesDuration(ep.duration_seconds || 0)

      return `    <item>
      <title>${escXml(ep.title || `ThreatNoir ${edition === 'afternoon' ? 'Afternoon' : 'Morning'} Brief`)}</title>
      <enclosure url="${escXml(ep.audio_url || '')}" type="audio/mpeg"/>
      <guid isPermaLink="false">${escXml(guid)}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <description>${escXml(description)}</description>
      <itunes:duration>${durationFormatted}</itunes:duration>
      <itunes:episode>${eps.length - idx}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
    </item>`
    })
    .join('\n')

  const year = new Date().getFullYear()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ThreatNoir — Security Intelligence Briefing</title>
    <link>https://threatnoir.com/podcast</link>
    <description>Daily security intelligence briefings curated for practitioners. Morning and afternoon editions covering vulnerabilities, breaches, ransomware, regulations, and threat intelligence. AI-curated from 1000+ sources, delivered as a conversational podcast under 5 minutes.</description>
    <language>en</language>
    <copyright>ThreatNoir ${year}</copyright>
    <atom:link href="https://threatnoir.com/api/podcast/feed.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>ThreatNoir</itunes:author>
    <itunes:summary>Daily security intelligence briefings. AI-curated from 1000+ sources, delivered as a conversational podcast. Morning and afternoon editions, under 5 minutes each. Covering vulnerabilities, breaches, ransomware, regulatory enforcement, and threat intelligence.</itunes:summary>
    <itunes:owner>
      <itunes:name>ThreatNoir</itunes:name>
      <itunes:email>marcus@threatnoir.com</itunes:email>
    </itunes:owner>
    <itunes:image href="https://threatnoir.com/podcast-artwork.jpg"/>
    <itunes:category text="Technology"/>
    <itunes:category text="News">
      <itunes:category text="Tech News"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
${items}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=900')

  return xml
})
