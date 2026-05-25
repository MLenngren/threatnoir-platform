import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { getClientIP, checkRateLimit } from '../../utils/rateLimit'

type Body = {
  title?: string
  body?: string
  suggested_category?: string
  submitter_name?: string
  submitter_email?: string
}

function cleanText(v: unknown, maxLen: number) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

function cleanOptionalText(v: unknown, maxLen: number) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

function normalizeEmail(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (!s) return null
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return null
  if (s.length > 320) return null
  return s
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)

  // Basic abuse throttle (IP) — coarse, in-memory, best-effort.
  const ipLimit = checkRateLimit(`tips:submit:${ip}`, 30, 60 * 60_000)
  if (!ipLimit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const supabase = serverSupabaseServiceRole(event)
  const body = (await readBody(event)) as Body

  const title = cleanText(body?.title, 200)
  const tipBody = cleanText(body?.body, 10_000)
  const suggestedCategory = cleanOptionalText(body?.suggested_category, 200)
  const submitterName = cleanText(body?.submitter_name, 200)
  const submitterEmail = normalizeEmail(body?.submitter_email)

  if (!title || title.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Title must be at least 3 characters' })
  }
  if (title.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Title must be at most 200 characters' })
  }
  if (!tipBody || tipBody.length < 10) {
    throw createError({ statusCode: 400, statusMessage: 'Body must be at least 10 characters' })
  }
  if (tipBody.length > 10_000) {
    throw createError({ statusCode: 400, statusMessage: 'Body must be at most 10000 characters' })
  }
  if (!submitterName) {
    throw createError({ statusCode: 400, statusMessage: 'Submitter name is required' })
  }

  // Email-based daily limit: max 3/day.
  if (submitterEmail) {
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)

    const countRes = await supabase
      .from('tip_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('submitter_email', submitterEmail)
      .gte('created_at', start.toISOString())

    if (countRes.error) {
      console.error('[tips/submit.post] DB error (rate check):', countRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    if ((countRes.count ?? 0) >= 3) {
      throw createError({ statusCode: 429, statusMessage: 'Submission limit reached for today' })
    }
  }

  const insertRes = await supabase.from('tip_submissions').insert({
    title,
    body: tipBody,
    suggested_category: suggestedCategory,
    submitter_name: submitterName,
    submitter_email: submitterEmail,
    status: 'pending'
  })

  if (insertRes.error) {
    console.error('[tips/submit.post] DB error:', insertRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  setResponseStatus(event, 201)
  return {
    success: true,
    message: 'Thanks! Your tip has been submitted for review.'
  }
})
