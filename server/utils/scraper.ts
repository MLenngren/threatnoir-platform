import { ofetch } from 'ofetch'
import { load } from 'cheerio'

import { validateUrlSafe } from './ssrf'
import { DEFAULT_SITE_URL } from '../../shared/siteDefaults'

const USER_AGENT = `ThreatIntel/1.0 (+${DEFAULT_SITE_URL})`

const SKIP_HOSTS = ['x.com', 'twitter.com', 'github.com']

function shouldSkipUrl(url: string): boolean {
  const u = (url || '').trim().toLowerCase()
  if (!u) return true

  for (const host of SKIP_HOSTS) {
    if (u.includes(host)) return true
  }

  // PDFs are typically not scrapeable with HTML parsing.
  if (/\.pdf(\?|#|$)/i.test(u)) return true

  return false
}

function cleanText(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

export async function scrapeArticleText(url: string): Promise<string | null> {
  try {
    if (shouldSkipUrl(url)) return null

    await validateUrlSafe(url)

    const html = await ofetch(url, {
		  headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
      responseType: 'text'
    })

    if (!html || typeof html !== 'string') return null

    const $ = load(html)

    // Strip noisy/irrelevant areas.
    $('script,style,nav,footer,header,aside,form,.ad,.sidebar,.comment,.social').remove()

    const candidates = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.entry-content',
      '.article-body',
      '.story-body'
    ]

    let text = ''
    for (const sel of candidates) {
      const el = $(sel).first()
      if (!el?.length) continue
      const t = cleanText(el.text())
      if (t.length > text.length) text = t
      if (text.length >= 400) break
    }

    if (!text) {
      text = cleanText($('body').text())
    }

    if (!text || text.length < 100) return null
    return text.slice(0, 8000)
  } catch {
    return null
  }
}

export async function scrapeArticleWithImage(url: string): Promise<{ text: string | null; ogImage: string | null }> {
  try {
    if (shouldSkipUrl(url)) return { text: null, ogImage: null }

    await validateUrlSafe(url)

    const html = await ofetch(url, {
		  headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
      responseType: 'text'
    })

    if (!html || typeof html !== 'string') return { text: null, ogImage: null }

    const $ = load(html)

    // Extract OG image before stripping elements
    const ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      null

    // Validate OG image URL
    let validOgImage: string | null = null
    if (ogImage && typeof ogImage === 'string') {
      const trimmed = ogImage.trim()
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        validOgImage = trimmed
      }
    }

    // Strip noisy areas for text extraction
    $('script,style,nav,footer,header,aside,form,.ad,.sidebar,.comment,.social').remove()

    const candidates = [
      'article', 'main', '[role="main"]',
      '.post-content', '.entry-content', '.article-body', '.story-body'
    ]

    let text = ''
    for (const sel of candidates) {
      const el = $(sel).first()
      if (!el?.length) continue
      const t = cleanText(el.text())
      if (t.length > text.length) text = t
      if (text.length >= 400) break
    }

    if (!text) {
      text = cleanText($('body').text())
    }

    const finalText = text && text.length >= 100 ? text.slice(0, 8000) : null

    return { text: finalText, ogImage: validOgImage }
  } catch {
    return { text: null, ogImage: null }
  }
}
