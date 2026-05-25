import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { writeAuditLog } from '../../../utils/auditLog'
import { processArticleAi } from '../../../utils/articleAiProcessor'

type Body = {
  status?: 'pending' | 'approved' | 'rejected'
  category_id?: string | null
  summary?: string | null
  ai_summary?: string | null
  tags?: string[]
}

export default defineEventHandler(async (event) => {
  const { supabase, user } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw new Error('Missing article id')

  const body = (await readBody(event)) as Body
  const patch: Record<string, unknown> = {}
  let normalizedTags: string[] | null = null

  if (typeof body.status === 'string') {
    patch.status = body.status
    if (body.status === 'approved') {
      // Only set published_at if it isn't already set.
      const { data: existing } = await supabase.from('articles').select('published_at').eq('id', id).single()
      if (!existing?.published_at) {
        patch.published_at = new Date().toISOString()
      }
    }
    if (body.status !== 'approved') {
      patch.published_at = null
    }
  }

  if ('category_id' in body) patch.category_id = body.category_id
  if ('summary' in body) patch.summary = body.summary
  if ('ai_summary' in body) patch.ai_summary = body.ai_summary

  const { data, error } = await supabase.from('articles').update(patch).eq('id', id).select('*').single()
	if (error) {
		console.error('[admin/articles/[id].patch] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

	// Auto-trigger AI processing when an admin manually approves an article that hasn't been enriched yet.
	// We do this inline (awaited) because Vercel serverless functions do not reliably support fire-and-forget
	// background work. For manual admin actions, a 10–30s wait is acceptable; a queue would be overkill.
	let aiProcessed: boolean | undefined
	let articleRow = data
	if (body.status === 'approved' && data?.ai_summary == null) {
		aiProcessed = false
		try {
			const aiRes = await processArticleAi(supabase, id, { overwriteStatus: false })
			aiProcessed = aiRes.ok
			if (!aiRes.ok) {
				console.error('[admin/articles/[id].patch] AI processing failed:', aiRes.error)
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			console.error('[admin/articles/[id].patch] AI processing crashed:', msg)
		}

		// Re-fetch so the response includes AI-filled fields when successful.
		const { data: refreshed, error: refreshError } = await supabase.from('articles').select('*').eq('id', id).single()
		if (refreshError) {
			console.error('[admin/articles/[id].patch] DB error (refresh):', refreshError.message)
		} else {
			articleRow = refreshed
		}
	}

  if ('tags' in body) {
    const tagIds = Array.isArray(body.tags) ? body.tags : []
    const normalized = Array.from(new Set(tagIds.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)))
    normalizedTags = normalized

    const { error: deleteError } = await supabase.from('article_tags').delete().eq('article_id', id)
		if (deleteError) {
			console.error('[admin/articles/[id].patch] DB error:', deleteError.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
		}

    if (normalized.length) {
      const { error: insertError } = await supabase.from('article_tags').insert(
        normalized.map((categoryId) => ({
          article_id: id,
          category_id: categoryId
        }))
      )
			if (insertError) {
				console.error('[admin/articles/[id].patch] DB error:', insertError.message)
				throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
			}
    }
  }

  let action = 'articles.update'
  if (typeof body.status === 'string') {
    action = body.status === 'approved' ? 'articles.approve' : body.status === 'rejected' ? 'articles.reject' : 'articles.set_status'
  }

  await writeAuditLog({
    user_id: user.id,
    action,
    resource_type: 'article',
    resource_id: id,
    details: {
      updated_fields: Object.keys(patch),
      status: typeof body.status === 'string' ? body.status : null,
      category_id: 'category_id' in body ? body.category_id : undefined,
      summary_changed: 'summary' in body,
      ai_summary_changed: 'ai_summary' in body,
      tags_updated: 'tags' in body,
      tag_count: normalizedTags ? normalizedTags.length : 0
    }
  })

	return { article: articleRow, ai_processed: aiProcessed }
})
