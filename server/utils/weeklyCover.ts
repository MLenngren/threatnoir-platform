import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

import { getSiteConfig } from './siteConfig'

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string } }>
    }
  }>
}

function buildPrompt(tagline: string, weekLabel: string): string {
  return (
    `Generate a 16:9 cinematic editorial cover image for a weekly cybersecurity intelligence briefing titled: "${tagline}" (week ${weekLabel}). ` +
    'Dark tactical command-center aesthetic. Background #0E131F (deep navy-black). Single accent color: cyan #4CD7F6. ' +
    'No text, no people, no faces, no logos. Abstract visual metaphor representing the week\'s theme. ' +
    'Cyberpunk-adjacent but restrained and professional. High contrast, moody lighting.'
  )
}

function decodeDataUrlPng(dataUrl: string): Buffer {
  const raw = (dataUrl || '').trim()
  const marker = ';base64,'
  const idx = raw.indexOf(marker)
  if (!raw.startsWith('data:image/') || idx === -1) {
    throw new Error('Unexpected image_url url format (expected data URL)')
  }
  const b64 = raw.slice(idx + marker.length)
  if (!b64) throw new Error('Missing base64 payload in data URL')
  return Buffer.from(b64, 'base64')
}

export async function generateAndUploadWeeklyCover(
  slug: string,
  tagline: string,
  weekLabel: string
): Promise<string | null> {
  try {
    const site = getSiteConfig()

    const apiKey = (process.env.OPENROUTER_API_KEY || '').trim()
    if (!apiKey) throw new Error('OPENROUTER_API_KEY missing')

    const endpoint = (process.env.R2_ENDPOINT || '').trim()
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim()
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim()
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials missing (R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY)')
    }

    const prompt = buildPrompt((tagline || '').trim(), (weekLabel || '').trim())
    if (!prompt.trim()) throw new Error('Empty prompt')

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text']
      })
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 300)}`)
    }

    const json = (await res.json()) as OpenRouterImageResponse
    const dataUrl = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('Missing image data URL in OpenRouter response')
    }

    const imageBuffer = decodeDataUrlPng(dataUrl)

    const s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey }
    })

	    const bucket = (process.env.R2_BUCKET || 'site-assets').trim() || 'site-assets'
    const key = `weekly/${slug}-cover.png`

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable'
      })
    )

	    const cdnBaseRaw = (process.env.NUXT_PUBLIC_CDN_BASE_URL || '').trim()
	    const cdnBase = (cdnBaseRaw || `${site.url}/cdn`).replace(/\/+$/, '')
	    return `${cdnBase}/${key}`
  } catch (err: unknown) {
    console.error('[weeklyCover] failed', err)
    return null
  }
}
