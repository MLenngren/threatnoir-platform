import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireAdminUser } from '../../../../utils/requireAdmin'
import { writeAuditLog } from '../../../../utils/auditLog'
import { processArticleAi } from '../../../../utils/articleAiProcessor'

export default defineEventHandler(async (event) => {
  const { supabase, user } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing article id' })

  const res = await processArticleAi(supabase, id, { overwriteStatus: false })

  await writeAuditLog({
    user_id: user.id,
    action: 'articles.ai_reprocess',
    resource_type: 'article',
    resource_id: id,
    details: {
      ok: res.ok,
      relevance_score: typeof res.relevance_score === 'number' ? res.relevance_score : null,
      error: res.ok ? null : res.error || null
    }
  })

  if (!res.ok) {
    if (res.error === 'not_found') {
      throw createError({ statusCode: 404, statusMessage: 'Article not found' })
    }
    if (res.error === 'ai_disabled') {
      throw createError({ statusCode: 503, statusMessage: 'AI processing is disabled' })
    }
    if (res.error === 'anthropic_key_missing') {
      throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY is not configured' })
    }
    throw createError({ statusCode: 500, statusMessage: 'AI processing failed' })
  }

  const { data: article, error } = await supabase.from('articles').select('*').eq('id', id).single()
  if (error) {
    console.error('[admin/articles/[id]/reprocess.post] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { ok: true, article }
})
