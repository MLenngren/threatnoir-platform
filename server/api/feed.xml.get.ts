import { createError, defineEventHandler, setResponseHeader } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { getSiteConfig } from '../utils/siteConfig'

type ArticleRow = {
  title: string | null
  slug: string | null
  brief: string | null
  published_at: string | null
}

type AwarenessRow = {
  title: string | null
  slug: string | null
  body: string | null
  created_at: string
}

type FocusRow = {
  id: string
  title: string | null
  summary: string | null
  created_at: string
}

type WeeklyRow = {
  week_label: string
  slug: string
  date_from: string
  date_to: string
  tldr: string | null
  full_brief: string | null
  created_at: string
  published_at: string | null
}

type PodcastRow = {
  date: string
  edition: string | null
  title: string | null
  audio_url: string | null
  article_text: string | null
  created_at: string
}

type FeedItem = {
  title: string
  link: string
  guid: { value: string; isPermaLink: boolean }
  pubDate: Date
  description: string
  categories: string[]
  enclosure?: { url: string; type: string }
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

const stripToExcerpt = (input: string, maxLen: number) => {
  const cleaned = input
    .replace(/^#+ .*/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()

  if (cleaned.length <= maxLen) return cleaned
  return `${cleaned.slice(0, maxLen)}...`
}

function podcastPubDate(ep: PodcastRow) {
  const date = new Date(ep.date)
  const edition = ep.edition || 'morning'
  const isAfternoon = edition === 'afternoon'
  date.setUTCHours(isAfternoon ? 15 : 5, 0, 0, 0)
  return date
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
	  const site = getSiteConfig()
  const siteUrl = normalizeSiteUrl()

  const [articlesRes, awarenessRes, focusRes, weeklyRes, podcastRes] = await Promise.all([
    supabase
      .from('articles')
      .select('title,slug,brief,published_at')
      .eq('status', 'approved')
      .not('slug', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from('awareness_lessons')
      .select('title,slug,body,created_at')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('focus_items')
      .select('id,title,summary,created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('weekly_roundups')
      .select('week_label,slug,date_from,date_to,tldr,full_brief,created_at,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('podcast_episodes')
      .select('date,edition,title,audio_url,article_text,created_at')
      .not('audio_url', 'is', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
  ])

  const firstErr = articlesRes.error || awarenessRes.error || focusRes.error || weeklyRes.error || podcastRes.error
  if (firstErr) {
    console.error('[feed.xml] DB error:', firstErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const items: FeedItem[] = []

  for (const a of (articlesRes.data ?? []) as ArticleRow[]) {
    const slug = (a.slug || '').trim()
    if (!slug) continue
    const link = `${siteUrl}/article/${encodeURIComponent(slug)}`
    const pubDate = new Date(a.published_at || new Date().toISOString())
    items.push({
      title: (a.title || '').trim() || 'ThreatNoir Article',
      link,
      guid: { value: link, isPermaLink: true },
      pubDate,
      description: (a.brief || '').trim(),
      categories: ['article']
    })
  }

  for (const l of (awarenessRes.data ?? []) as AwarenessRow[]) {
    const slug = (l.slug || '').trim()
    if (!slug) continue
    const link = `${siteUrl}/awareness/${encodeURIComponent(slug)}`
    items.push({
      title: (l.title || '').trim() || 'ThreatNoir Awareness Lesson',
      link,
      guid: { value: link, isPermaLink: true },
      pubDate: new Date(l.created_at),
      description: stripToExcerpt(l.body || '', 500),
      categories: ['awareness']
    })
  }

  for (const f of (focusRes.data ?? []) as FocusRow[]) {
    const link = `${siteUrl}/focus`
    items.push({
      title: (f.title || '').trim() || 'ThreatNoir Focus Item',
      link,
      guid: { value: f.id, isPermaLink: false },
      pubDate: new Date(f.created_at),
      description: (f.summary || '').trim(),
      categories: ['focus']
    })
  }

  for (const w of (weeklyRes.data ?? []) as WeeklyRow[]) {
    const slug = (w.slug || '').trim()
    if (!slug) continue
    const link = `${siteUrl}/weekly/${encodeURIComponent(slug)}`
    const pub = new Date(w.published_at || w.created_at)
    const title = `Weekly Threat Roundup ${w.week_label} (${w.date_from} to ${w.date_to})`
    items.push({
      title,
      link,
      guid: { value: link, isPermaLink: true },
      pubDate: pub,
      description: stripToExcerpt(w.tldr || w.full_brief || '', 500),
      categories: ['weekly']
    })
  }

  for (const p of (podcastRes.data ?? []) as PodcastRow[]) {
    const pub = podcastPubDate(p)
    const edition = p.edition || 'morning'
    const guid = `${p.date}-${edition}`
    const link = `${siteUrl}/podcast`
    const desc = stripToExcerpt(p.article_text || p.title || '', 500)
    const audio = (p.audio_url || '').trim()

    items.push({
      title: (p.title || '').trim() || `ThreatNoir Podcast (${edition})`,
      link,
      guid: { value: guid, isPermaLink: false },
      pubDate: pub,
      description: desc,
      categories: ['podcast'],
      ...(audio ? { enclosure: { url: audio, type: 'audio/mpeg' } } : {})
    })
  }

  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
  const top = items.slice(0, 50)
  const lastBuildDate = (top[0]?.pubDate || new Date()).toUTCString()

  const itemXml = top
    .map((it) => {
      const cats = (it.categories || []).map((c) => `\n      <category>${escXml(c)}</category>`).join('')
      const enclosure = it.enclosure
        ? `\n      <enclosure url="${escXml(it.enclosure.url)}" type="${escXml(it.enclosure.type)}"/>`
        : ''

      return `    <item>
      <title>${escXml(it.title)}</title>
      <link>${escXml(it.link)}</link>
      <guid isPermaLink="${it.guid.isPermaLink ? 'true' : 'false'}">${escXml(it.guid.value)}</guid>
      <pubDate>${it.pubDate.toUTCString()}</pubDate>
      <description>${wrapCdata(it.description)}</description>${cats}${enclosure}
    </item>`
    })
    .join('\n')

  const year = new Date().getFullYear()
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
	    <title>${site.name} — All Content</title>
    <link>${escXml(siteUrl)}</link>
	    <description>${wrapCdata('Curated cybersecurity news and analysis')}</description>
    <language>en</language>
    <copyright>ThreatNoir ${year}</copyright>
    <atom:link href="${escXml(`${siteUrl}/api/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemXml}
  </channel>
</rss>`

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return xml
})
