/**
 * Backfill OG images for approved articles that don't have an image_url.
 *
 * Usage: npx tsx scripts/backfill-og-images.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
if (!SUPABASE_URL) throw new Error('SUPABASE_URL env var required')
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_KEY env var required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SITE_NAME = (process.env.NUXT_PUBLIC_SITE_NAME || 'Example Site').trim() || 'Example Site'
const SITE_URL = (process.env.NUXT_PUBLIC_SITE_URL || 'https://example.com').trim().replace(/\/+$/, '') || 'https://example.com'
const HTTP_USER_AGENT = (process.env.HTTP_USER_AGENT || `${SITE_NAME}/1.0 (+${SITE_URL})`).trim()

const SKIP_HOSTS = ['x.com', 'twitter.com', 'github.com']

function shouldSkip(url: string): boolean {
  const u = (url || '').trim().toLowerCase()
  if (!u) return true
  for (const host of SKIP_HOSTS) {
    if (u.includes(host)) return true
  }
  if (/\.pdf(\?|#|$)/i.test(u)) return true
  return false
}

async function extractOgImage(url: string): Promise<string | null> {
  try {
    if (shouldSkip(url)) return null

    const resp = await fetch(url, {
	      headers: { 'User-Agent': HTTP_USER_AGENT },
      signal: AbortSignal.timeout(10_000),
      redirect: 'follow'
    })

    if (!resp.ok) return null
    const html = await resp.text()
    if (!html) return null

    // Extract og:image or twitter:image
    const ogMatch = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
      || html.match(/<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i)

    if (!ogMatch) return null
    const img = ogMatch[1].trim()
    if (!img.startsWith('http://') && !img.startsWith('https://')) return null
    return img
  } catch {
    return null
  }
}

async function main() {
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id,url')
    .eq('status', 'approved')
    .is('image_url', null)
    .not('url', 'is', null)
    .limit(500)

  if (error) {
    console.error('DB error:', error.message)
    process.exit(1)
  }

  console.log(`Found ${articles?.length ?? 0} articles without images`)

  let updated = 0
  let failed = 0

  for (const a of articles ?? []) {
    const img = await extractOgImage(a.url)
    if (img) {
      const { error: updateErr } = await supabase
        .from('articles')
        .update({ image_url: img })
        .eq('id', a.id)

      if (updateErr) {
        console.error(`  Failed to update ${a.id}: ${updateErr.message}`)
        failed++
      } else {
        updated++
        if (updated % 10 === 0) console.log(`  Updated ${updated}...`)
      }
    } else {
      failed++
    }

    // Rate limit to avoid hammering sources
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`Done. Updated: ${updated}, No image found: ${failed}`)
}

main()
