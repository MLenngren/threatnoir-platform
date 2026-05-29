import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { randomUUID } from 'crypto'

import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { tagResourceImage } from '../../../utils/resourceTagger'

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
	  const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
	  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
	  if (IMAGE_TYPES.has(filePart.type) && (gatewayUrl || apiKey)) {
	    try {
	      const base64 = filePart.data.toString('base64')
	      const mediaType = filePart.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

	      const tagged = await tagResourceImage({ mediaType, base64 })
	      if (tagged) {
	        result.ai = {
	          title: tagged.title || '',
	          description: tagged.description || '',
	          category: CATEGORIES.includes(tagged.category) ? tagged.category : '',
	          tags: (tagged.tags || []).slice(0, 8)
	        }
	      }
	    } catch (e) {
	      console.error('[admin/resources/upload] AI analysis failed:', e instanceof Error ? e.message : e)
	      // Non-critical — return upload result without AI suggestions
	    }
	  }

  return result
})
