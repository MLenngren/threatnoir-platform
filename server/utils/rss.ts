import Parser from 'rss-parser'

import { validateUrlSafe } from './ssrf'

export type RssArticle = {
  title: string
  url: string
  summary: string | null
  publishedAt: string | null
  imageUrl: string | null
}

const normalizeHttpUrlOrNull = (value?: string): string | null => {
  const input = (value || '').trim()
  if (!input) return null

  try {
    const parsed = new URL(input)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

type RssItem = Record<string, unknown> & {
  title?: string
  link?: string
  guid?: string
  pubDate?: string
  isoDate?: string
  content?: string
  contentSnippet?: string
  enclosure?: { url?: string }
}

const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'media:content', 'media:thumbnail']
  }
})

const stripHtml = (input: string) => {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractMediaUrl = (maybe: unknown): string | null => {
  // rss-parser can represent custom XML fields as objects with a `$` attribute bag.
  if (!maybe) return null

  if (Array.isArray(maybe)) {
    for (const item of maybe) {
      const found = extractMediaUrl(item)
      if (found) return found
    }
    return null
  }

  if (typeof maybe === 'object') {
    const obj = maybe as Record<string, unknown>
    const directUrl = typeof obj.url === 'string' ? obj.url : null
    if (directUrl) return directUrl
    const attrs = obj.$
    if (attrs && typeof attrs === 'object') {
      const a = attrs as Record<string, unknown>
      if (typeof a.url === 'string') return a.url
    }
  }

  return null
}

const getImageUrl = (item: RssItem): string | null => {
  if (item.enclosure?.url) return item.enclosure.url
  const mediaContent = extractMediaUrl(item['media:content'])
  if (mediaContent) return mediaContent
  const mediaThumb = extractMediaUrl(item['media:thumbnail'])
  if (mediaThumb) return mediaThumb
  return null
}

const toIsoOrNull = (value?: string) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export const parseRssFeed = async (feedUrl: string): Promise<RssArticle[]> => {
  await validateUrlSafe(feedUrl)
  const feed = await parser.parseURL(feedUrl)

  return (feed.items ?? [])
    .map((raw) => raw as unknown as RssItem)
    .map((item) => {
      const url = normalizeHttpUrlOrNull(item.link || item.guid) || ''
      const title = (item.title || '').trim()
      const rawSummary =
        item.contentSnippet ||
        item.content ||
        (typeof item['content:encoded'] === 'string'
          ? (item['content:encoded'] as string)
          : '')

      const summaryText = rawSummary ? stripHtml(rawSummary) : ''
      const publishedAt = toIsoOrNull(item.isoDate || item.pubDate)

      return {
        title,
        url,
        summary: summaryText || null,
        publishedAt,
        imageUrl: getImageUrl(item)
      } satisfies RssArticle
    })
    .filter((a) => Boolean(a.title) && Boolean(a.url))
}
