import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export class UrlBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlBlockedError'
  }
}

function parseIPv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const out = parts.map((p) => Number(p))
  if (out.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return out as [number, number, number, number]
}

export function isPrivateIPv4(ip: string): boolean {
  const o = parseIPv4(ip)
  if (!o) return false
  const [a, b, c, d] = o

  // 0.0.0.0
  if (a === 0 && b === 0 && c === 0 && d === 0) return true

  // 127.0.0.0/8
  if (a === 127) return true

  // 10.0.0.0/8
  if (a === 10) return true

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true

  // 169.254.0.0/16 (incl. cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true

  return false
}

export function isPrivateIPv6(ip: string): boolean {
  const v = (ip || '').toLowerCase()

  // ::1 loopback
  if (v === '::1') return true

  // Unique local addresses fc00::/7 (fc.. or fd..)
  if (v.startsWith('fc') || v.startsWith('fd')) return true

  return false
}

/**
 * Synchronous hostname/IP literal checks.
 * - Blocks: localhost, *.local, *.internal
 * - Blocks IP literals for: 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 0.0.0.0, ::1, fc00::/7
 */
export function isPrivateIP(hostname: string): boolean {
  const h = (hostname || '').trim().toLowerCase()
  if (!h) return true

  if (h === 'localhost') return true
  if (h.endsWith('.local') || h.endsWith('.internal')) return true

  const ipKind = isIP(h)
  if (ipKind === 4) return isPrivateIPv4(h)
  if (ipKind === 6) return isPrivateIPv6(h)

  return false
}

export async function resolvesToPrivateIP(hostname: string): Promise<boolean> {
  const h = (hostname || '').trim().toLowerCase()
  if (!h) return true
  if (isIP(h)) return false // already handled as a literal elsewhere

  try {
    const records = await lookup(h, { all: true, verbatim: true })
    for (const r of records) {
      if (r.family === 4 && isPrivateIPv4(r.address)) return true
      if (r.family === 6 && isPrivateIPv6(r.address)) return true
    }
  } catch {
    // Best-effort: if DNS resolution fails here, we fall back to hostname string checks.
  }

  return false
}

/**
 * Validates a URL for SSRF safety.
 * - Only allows http(s)
 * - Blocks localhost / internal hostnames and private IP literals
 * - Blocks hostnames that resolve to private IPs
 */
export async function validateUrlSafe(url: string): Promise<void> {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    throw new UrlBlockedError('Invalid URL')
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    throw new UrlBlockedError(`Blocked non-http(s) protocol: ${urlObj.protocol}`)
  }

  const host = urlObj.hostname
  if (isPrivateIP(host)) {
    throw new UrlBlockedError(`Blocked private/internal hostname: ${host}`)
  }
  if (await resolvesToPrivateIP(host)) {
    throw new UrlBlockedError(`Blocked private/internal IP resolution: ${host}`)
  }
}
