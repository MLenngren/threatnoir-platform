import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireAdminUser } from '../../../../utils/requireAdmin'

type Body = {
  status?: 'approved' | 'rejected'
  reviewer_notes?: string | null
}

async function resolveTipCategoryId(
  supabase: SupabaseClient,
  suggestedCategory: string | null
): Promise<string | null> {
  const raw = (suggestedCategory || '').trim()
  if (!raw) return null

  // First try slug match (common when coming from the dropdown).
  const slugRes = await supabase.from('tip_categories').select('id').eq('slug', raw).maybeSingle<{ id: string }>()
  if (slugRes.error) {
    console.error('[admin/tips/submissions/[id].patch] DB error (category slug lookup):', slugRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (slugRes.data?.id) return slugRes.data.id

  // Then try name match (case-insensitive).
  const nameRes = await supabase.from('tip_categories').select('id').ilike('name', raw).maybeSingle<{ id: string }>()
  if (nameRes.error) {
    console.error('[admin/tips/submissions/[id].patch] DB error (category name lookup):', nameRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  return nameRes.data?.id ?? null
}

function normalizeNotes(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  return s.length <= 5000 ? s : s.slice(0, 5000)
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing submission id' })

  const body = (await readBody(event)) as Body
  const status = body?.status === 'approved' ? 'approved' : body?.status === 'rejected' ? 'rejected' : null
  if (!status) {
    throw createError({ statusCode: 400, statusMessage: 'Missing status' })
  }

  const reviewerNotes = normalizeNotes(body?.reviewer_notes)
  const reviewedAt = new Date().toISOString()

  const { data: submission, error: subErr } = await supabase
    .from('tip_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (subErr) {
    console.error('[admin/tips/submissions/[id].patch] DB error (fetch):', subErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!submission) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // Idempotency: if already in desired state, just update reviewer notes (optional) and return.
  if (submission.status === status) {
    const { error: noteErr } = await supabase
      .from('tip_submissions')
      .update({ reviewer_notes: reviewerNotes, reviewed_at: reviewedAt })
      .eq('id', id)
    if (noteErr) {
      console.error('[admin/tips/submissions/[id].patch] DB error (notes update):', noteErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    return { ok: true, status }
  }

  if (status === 'rejected') {
    const { error } = await supabase
      .from('tip_submissions')
      .update({ status: 'rejected', reviewer_notes: reviewerNotes, reviewed_at: reviewedAt })
      .eq('id', id)
    if (error) {
      console.error('[admin/tips/submissions/[id].patch] DB error (reject):', error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    return { ok: true, status: 'rejected' }
  }

  // Approve: create a published tip, then mark submission approved.
  const categoryId = await resolveTipCategoryId(supabase as unknown as SupabaseClient, submission.suggested_category)

  const { data: tip, error: tipErr } = await supabase
    .from('tips')
    .insert({
      title: submission.title,
      body: submission.body,
      category_id: categoryId,
      tags: [],
      author_name: submission.submitter_name,
      author_id: null,
      status: 'published',
      featured: false
    })
    .select('id')
    .single()

  if (tipErr) {
    console.error('[admin/tips/submissions/[id].patch] DB error (create tip):', tipErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const { error: updErr } = await supabase
    .from('tip_submissions')
    .update({ status: 'approved', reviewer_notes: reviewerNotes, reviewed_at: reviewedAt })
    .eq('id', id)

  if (updErr) {
    // Best-effort rollback to avoid leaving a published tip without an approved submission.
    try {
      await supabase.from('tips').delete().eq('id', tip.id)
    } catch {
      // ignore
    }
    console.error('[admin/tips/submissions/[id].patch] DB error (approve update):', updErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { ok: true, status: 'approved', tipId: tip.id }
})
