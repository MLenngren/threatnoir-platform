import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { requireAdminUser } from '../../../utils/requireAdmin'
import { generateArticleSlug } from '../../../utils/slugify'
import { getSiteConfig } from '../../../utils/siteConfig'
import type { SupabaseClient } from '@supabase/supabase-js'

type Body = {
  action: 'approve' | 'reject'
}

async function getOrCreateCommunitySource(supabase: SupabaseClient) {
  const { data: existing } = await supabase
    .from('sources')
    .select('id,name,url,type')
    .eq('type', 'community')
    .limit(1)
    .maybeSingle()

  if (existing?.id) return existing

  const { data: created, error } = await supabase
    .from('sources')
	  .insert({ name: 'Community', url: `${getSiteConfig().url}/community`, type: 'community', is_active: true })
    .select('id,name,url,type')
    .single()
	if (error) {
		console.error('[admin/submissions/[id].patch] DB error:', error.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return created
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw new Error('Missing submission id')

  const body = (await readBody(event)) as Body
  if (!body?.action) throw new Error('Missing action')

  if (body.action === 'reject') {
    const { error } = await supabase.from('submissions').update({ status: 'rejected' }).eq('id', id)
		if (error) {
			console.error('[admin/submissions/[id].patch] DB error:', error.message)
			throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
		}
    return { ok: true }
  }

  // Approve: create an article, then mark submission approved.
  const { data: submission, error: submissionError } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', id)
    .single()
	if (submissionError) {
		console.error('[admin/submissions/[id].patch] DB error:', submissionError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  const communitySource = await getOrCreateCommunitySource(supabase)

  const title = submission.suggested_title || submission.url
  const now = new Date().toISOString()

  const { data: article, error: articleError } = await supabase
    .from('articles')
    .insert({
      title,
	      slug: generateArticleSlug(title, submission.url),
      url: submission.url,
      source_id: communitySource.id,
      status: 'approved',
      is_community_submitted: true,
      ingested_at: now,
      published_at: now
    })
    .select('id')
    .single()
	if (articleError) {
		console.error('[admin/submissions/[id].patch] DB error:', articleError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  const { error: updateSubmissionError } = await supabase
    .from('submissions')
    .update({ status: 'approved' })
    .eq('id', id)
	if (updateSubmissionError) {
		console.error('[admin/submissions/[id].patch] DB error:', updateSubmissionError.message)
		throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { ok: true, articleId: article.id }
})
