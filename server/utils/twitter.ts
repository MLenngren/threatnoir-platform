import { createHmac, randomBytes } from 'node:crypto'

import { DEFAULT_SITE_URL } from '../../shared/siteDefaults'

const X_API_URL = 'https://api.x.com/2/tweets'
const MAX_TWEET_LEN = 280
const URL_CHAR_COUNT = 23 // t.co wrapping

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function tweetCharCount(input: string): number {
  const s = String(input || '')
  // Approximate X length rules: URLs are wrapped by t.co and count as a fixed length.
  return s.replace(/https?:\/\/\S+/g, 'x'.repeat(URL_CHAR_COUNT)).length
}

function truncateTweet(input: string, maxLen = MAX_TWEET_LEN): string {
  let s = String(input || '').trim()
  if (!s) return ''
  if (tweetCharCount(s) <= maxLen) return s

  // Conservative truncation: shorten until it fits, then add ellipsis.
  while (s.length > 0 && tweetCharCount(s) > maxLen - 1) {
    s = s.slice(0, -1)
  }

  return `${s.trimEnd()}…`
}

function buildOAuthHeader(
  method: string,
  url: string,
  _body: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomBytes(16).toString('hex')

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0'
  }

  // Combine oauth params (+ query params if any). For JSON body POST, body params are NOT included.
  const allParams: Record<string, string> = { ...oauthParams }

  const paramStr = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k] ?? '')}`)
    .join('&')

  const baseStr = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramStr)}`
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`
  const signature = createHmac('sha1', signingKey).update(baseStr).digest('base64')

  oauthParams.oauth_signature = signature

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k] ?? '')}"`)
    .join(', ')

  return `OAuth ${header}`
}

/**
 * Post a tweet to X. Returns tweet ID+text or null if credentials not set.
 * Never throws — logs errors and returns null.
 */
export async function postTweet(text: string): Promise<{ id: string; text: string } | null> {
  const consumerKey = (process.env.X_CONSUMER_KEY || '').trim()
  const consumerSecret = (process.env.X_CONSUMER_SECRET || '').trim()
  const accessToken = (process.env.X_ACCESS_TOKEN || '').trim()
  const accessTokenSecret = (process.env.X_ACCESS_TOKEN_SECRET || '').trim()

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    console.warn('[twitter] X credentials not configured, skipping post')
    return null
  }

  const trimmed = truncateTweet(text).slice(0, MAX_TWEET_LEN)
  if (!trimmed) {
    console.warn('[twitter] empty tweet text, skipping post')
    return null
  }

  try {
    const authHeader = buildOAuthHeader(
      'POST',
      X_API_URL,
      {},
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret
    )

    const resp = await fetch(X_API_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: trimmed })
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.error(`[twitter] API error ${resp.status}: ${errText.slice(0, 300)}`)
      return null
    }

    const data = (await resp.json().catch(() => null)) as { data?: { id?: string; text?: string } } | null
    const id = data?.data?.id || ''
    console.log(`[twitter] posted tweet ${id || '(unknown id)'}`)
    if (!id) return null
    return { id, text: data?.data?.text || trimmed }
  } catch (err) {
    console.error('[twitter] post failed:', err instanceof Error ? err.message : err)
    return null
  }
}

function cleanSiteUrl(siteUrl: string): string {
	  return (siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '')
}

export function formatWeeklyTweet(data: { weekLabel: string; slug: string; tldr: string; siteUrl: string }): string {
  const base = cleanSiteUrl(data.siteUrl)
  const url = `${base}/weekly/${data.slug}`
  const hook = (data.tldr || '')
    .split('\n')[0]
    .replace(/^[^\w]*/, '')
    .slice(0, 200)

  return truncateTweet(`${data.weekLabel} Threat Roundup\n\n${hook}\n\n${url}\n\n#cybersecurity #threatintel`)
}

export function formatInsightTweet(data: { title: string; slug: string; siteUrl: string }): string {
  const base = cleanSiteUrl(data.siteUrl)
  const url = `${base}/article/${data.slug}`
  const title = (data.title || '').slice(0, 200)
  return truncateTweet(`${title}\n\n${url}\n\n#cybersecurity`)
}

export function formatFocusTweet(data: { title: string; severity: string; summary: string; siteUrl: string }): string {
  const base = cleanSiteUrl(data.siteUrl)
  const sev = (data.severity || '').toUpperCase()
  const summary = (data.summary || '').slice(0, 180)
  return truncateTweet(`⚠️ ${sev}: ${data.title}\n\n${summary}\n\n${base}/focus\n\n#cybersecurity`)
}
