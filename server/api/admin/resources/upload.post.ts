import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { randomUUID } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'

import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { logAiCall } from '../../../utils/aiUsage'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const CATEGORIES = ['AI Security', 'Network Security', 'Cloud Security', 'Compliance', 'Incident Response', 'Best Practices', 'Threat Intel']

export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const filePart = parts.find((p) => p.name === 'file')
  if (!filePart || !filePart.data || !filePart.type) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file field' })
  }

  if (!ALLOWED_TYPES.has(filePart.type)) {
    throw createError({ statusCode: 400, statusMessage: `File type not allowed: ${filePart.type}` })
  }

  if (filePart.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'File too large (max 10MB)' })
  }

  const ext = filePart.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
  const fileName = `${randomUUID()}.${ext}`
  const filePath = `uploads/${fileName}`

  const supabase = serverSupabaseServiceRole(event)

  const { error } = await supabase.storage
    .from('resources')
    .upload(filePath, filePart.data, {
      contentType: filePart.type,
      upsert: false
    })

  if (error) {
    console.error('[admin/resources/upload] Storage error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Upload failed' })
  }

  const { data: urlData } = supabase.storage
    .from('resources')
    .getPublicUrl(filePath)

  const result: {
    url: string
    path: string
    fileName: string
    ai?: { title: string; description: string; category: string; tags: string[] }
  } = {
    url: urlData.publicUrl,
    path: filePath,
    fileName
  }

  // Auto-analyze image with Claude Vision (best-effort)
  if (IMAGE_TYPES.has(filePart.type) && process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const base64 = filePart.data.toString('base64')
      const mediaType = filePart.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

	      const model = 'claude-haiku-4-5-20251001'
	      const startedAt = Date.now()
	      const resp = await client.messages.create({
	        model,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: `Analyze this security resource image. Return JSON only, no markdown:
{
  "title": "short descriptive title for this resource",
  "description": "1-2 sentence technical summary of what this resource covers",
  "category": "one of: ${CATEGORIES.join(', ')}",
  "tags": ["tag1", "tag2", "tag3"] (3-5 relevant lowercase tags)
}`
            }
          ]
        }]
      })

	      await logAiCall({
	        pipeline: 'resource_upload_analyze',
	        model,
	        response: resp,
	        durationMs: Date.now() - startedAt,
	        metadata: {
	          file_type: filePart.type,
	          file_bytes: filePart.data.length
	        }
	      })

      const text = (resp.content || [])
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim()

      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        result.ai = {
          title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
          description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
          category: CATEGORIES.includes(parsed.category) ? parsed.category : '',
          tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string').slice(0, 8) : []
        }
      }
    } catch (e) {
      console.error('[admin/resources/upload] AI analysis failed:', e instanceof Error ? e.message : e)
      // Non-critical — return upload result without AI suggestions
    }
  }

  return result
})
