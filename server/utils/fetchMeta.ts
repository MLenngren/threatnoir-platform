import { UrlBlockedError, isPrivateIP, resolvesToPrivateIP } from './ssrf'

type UrlMeta = {
  title?: string
  description?: string
  image?: string
}

const TIMEOUT_MS = 5000
const MAX_REDIRECTS = 3
const MAX_BYTES = 512 * 1024 // 512KB

const SKIP_DOMAINS = [
  'x.com',
  'twitter.com',
  't.co',
  'imgur.com',
  'giphy.com',
  'gfycat.com',
  'youtube.com',
  'youtu.be',
  'linkedin.com',
  'github.com',
  'pastebin.com'
]

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const h = (hostname || '').toLowerCase()
  const d = (domain || '').toLowerCase()
  if (!h || !d) return false
  return h === d || h.endsWith('.' + d)
}

function shouldSkipUrl(url: URL): boolean {
  const host = (url.hostname || '').toLowerCase()
  return SKIP_DOMAINS.some((d) => hostnameMatchesDomain(host, d))
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanMetaValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = stripHtmlTags(decodeHtmlEntities(value)).trim()
  if (!v) return undefined
  return v.length > 4000 ? v.slice(0, 4000).trim() : v
}

function parseMetaTags(html: string): Array<Record<string, string>> {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  const out: Array<Record<string, string>> = []

  for (const tag of tags) {
    const attrs: Record<string, string> = {}

    const attrRe = /([a-zA-Z_:][a-zA-Z0-9_:\-.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
    for (const m of tag.matchAll(attrRe)) {
      const name = (m[1] || '').toLowerCase()
      const value = m[2] ?? m[3] ?? m[4] ?? ''
      if (!name) continue
      attrs[name] = value
    }
    out.push(attrs)
  }

  return out
}

function findMetaContent(html: string, keys: string[]): string | undefined {
  const desired = new Set(keys.map((k) => k.toLowerCase()))
  const tags = parseMetaTags(html)

  for (const attrs of tags) {
    const key = (attrs.property || attrs.name || '').toLowerCase()
    if (!key || !desired.has(key)) continue
    const content = attrs.content
    const cleaned = cleanMetaValue(content)
    if (cleaned) return cleaned
  }
  return undefined
}

function findTitleTag(html: string): string | undefined {
  const m = html.match(/<title\b[^>]*>([^<]{1,4000})<\/title>/i)
  return cleanMetaValue(m?.[1])
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

async function fetchWithRedirectLimit(startUrl: URL, signal: AbortSignal): Promise<Response | null> {
  let current = startUrl
  const visited = new Set<string>()

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    if (shouldSkipUrl(current)) return null

    const host = current.hostname
    if (isPrivateIP(host)) {
      throw new UrlBlockedError(`Blocked private/internal hostname: ${host}`)
    }
    if (await resolvesToPrivateIP(host)) {
      throw new UrlBlockedError(`Blocked private/internal IP resolution: ${host}`)
    }

    const key = current.toString()
    if (visited.has(key)) return null
    visited.add(key)

    const res = await fetch(current.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: {
        'user-agent': 'ThreatNoir/1.0',
        accept: 'text/html,application/xhtml+xml'
      }
    })

    if (isRedirectStatus(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) return null

      let next: URL
      try {
        next = new URL(loc, current)
      } catch {
        return null
      }

      if (next.protocol !== 'http:' && next.protocol !== 'https:') {
        throw new UrlBlockedError(`Blocked non-http(s) redirect: ${next.protocol}`)
      }

      if (i >= MAX_REDIRECTS) return null
      current = next
      continue
    }

    return res
  }

  return null
}

async function readHeadHtml(res: Response, signal: AbortSignal): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''

  const decoder = new TextDecoder('utf-8')
  let totalBytes = 0
  let html = ''
  let doneEarly = false

  try {
    while (true) {
      if (signal.aborted) break

      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      if (totalBytes + value.byteLength > MAX_BYTES) {
        // Stop reading further to avoid DoS / huge responses.
        const allowed = Math.max(0, MAX_BYTES - totalBytes)
        if (allowed > 0) {
          html += decoder.decode(value.slice(0, allowed), { stream: true })
        }
        totalBytes = MAX_BYTES
        doneEarly = true
        break
      }

      totalBytes += value.byteLength
      html += decoder.decode(value, { stream: true })
      const lower = html.toLowerCase()
      if (lower.includes('</head>') || lower.includes('<body')) {
        doneEarly = true
        break
      }
    }
  } finally {
    try {
      if (doneEarly) await reader.cancel()
    } catch {
      // ignore
    }
  }

  html += decoder.decode()

  const lower = html.toLowerCase()
  const headEnd = lower.indexOf('</head>')
  if (headEnd !== -1) return html.slice(0, headEnd + '</head>'.length)

  const bodyIdx = lower.indexOf('<body')
  if (bodyIdx !== -1) return html.slice(0, bodyIdx)

  return html
}

/**
 * Fetches and parses basic Open Graph metadata from a URL.
 * - Timeout: 5 seconds
 * - User-Agent: ThreatNoir/1.0
 */
export async function fetchUrlMeta(url: string): Promise<UrlMeta> {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return {}
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw new UrlBlockedError(`Blocked non-http(s) protocol: ${urlObj.protocol}`)
  }
  if (shouldSkipUrl(urlObj)) return {}

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetchWithRedirectLimit(urlObj, controller.signal)
    if (!res || !res.ok) return {}

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return {}
    }

    const html = await readHeadHtml(res, controller.signal)

    const title =
      findMetaContent(html, ['og:title', 'twitter:title']) ||
      findTitleTag(html) ||
      findMetaContent(html, ['title'])

    const description = findMetaContent(html, ['og:description', 'twitter:description', 'description'])
    const image = findMetaContent(html, ['og:image', 'twitter:image', 'twitter:image:src'])

    return {
      title: cleanMetaValue(title),
      description: cleanMetaValue(description),
      image: cleanMetaValue(image)
    }
  } catch (err: unknown) {
    if (err instanceof UrlBlockedError) throw err
    return {}
  } finally {
    clearTimeout(timeout)
  }
}
