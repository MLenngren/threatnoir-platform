import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'

import { notifyAdmin } from '../../utils/notifyAdmin'
import { useSupabaseAdmin } from '../../utils/supabase'

type Body = {
  title?: unknown
  url?: unknown
  start_date?: unknown
  end_date?: unknown
  location?: unknown
  is_virtual?: unknown
  organizer?: unknown
  category?: unknown
  description?: unknown
  submitted_by_email?: unknown
}

const VALID_CATEGORIES = new Set(['conference', 'workshop', 'webinar', 'ctf', 'meetup'])

function cleanText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : s.slice(0, maxLen)
}

function cleanOptionalText(v: unknown, maxLen: number): string | null {
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

function normalizeUrl(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (!s.startsWith('http://') && !s.startsWith('https://')) return null
  if (s.length > 2000) return null
  return s
}

function normalizeIsoDate(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function findUniqueSlug(supabase: ReturnType<typeof useSupabaseAdmin>, base: string): Promise<string> {
  const safeBase = (base || '').trim() || `event-${Date.now().toString(10)}`
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? safeBase : `${safeBase}-${i}`
    const check = await supabase.from('events').select('id').eq('slug', candidate).maybeSingle()
    if (check.error) throw check.error
    if (!check.data) return candidate
  }
  return `${safeBase}-${Date.now().toString(10)}`
}

export default defineEventHandler(async (event) => {
  const supabase = useSupabaseAdmin()
  const body = (await readBody(event)) as Body

  const title = cleanText(body?.title, 200)
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required' })
  }
  if (title.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Title must be at most 200 characters' })
  }

  const startDate = normalizeIsoDate(body?.start_date)
  if (!startDate) {
    throw createError({ statusCode: 400, statusMessage: 'start_date must be YYYY-MM-DD' })
  }

  const endDate = normalizeIsoDate(body?.end_date)
  if (endDate && endDate < startDate) {
    throw createError({ statusCode: 400, statusMessage: 'end_date must be on/after start_date' })
  }

  const url = normalizeUrl(body?.url)
  if (body?.url && !url) {
    throw createError({ statusCode: 400, statusMessage: 'url must start with http(s)' })
  }

  const categoryRaw = typeof body?.category === 'string' ? body.category.trim().toLowerCase() : ''
  const category = categoryRaw ? (VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : null) : 'conference'
  if (categoryRaw && !category) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid category' })
  }

  const location = cleanOptionalText(body?.location, 200)
  const organizer = cleanOptionalText(body?.organizer, 200)
  const description = cleanOptionalText(body?.description, 5000)
  const submittedByEmail = normalizeEmail(body?.submitted_by_email)

  const isVirtual = typeof body?.is_virtual === 'boolean' ? body.is_virtual : false

  const baseSlug = generateSlug(title)
  const slug = await findUniqueSlug(supabase, baseSlug)

  const insertBase = {
    title,
    slug,
    description,
    url,
    start_date: startDate,
    end_date: endDate,
    location,
    is_virtual: isVirtual,
    organizer,
    category,
    status: 'pending',
    is_community_submitted: true,
    submitted_by_email: submittedByEmail
  }

  // Insert; handle race on slug uniqueness with best-effort retries.
  let inserted = await supabase.from('events').insert(insertBase).select('id,slug').single()
  if (inserted.error && (inserted.error as unknown as { code?: string }).code === '23505') {
    // Retry with numeric suffix.
    for (let i = 2; i <= 20; i++) {
      const nextSlug = `${baseSlug.slice(0, Math.max(0, 80 - (`-${i}`.length)))}-${i}`
      inserted = await supabase
        .from('events')
        .insert({ ...insertBase, slug: nextSlug })
        .select('id,slug')
        .single()
      if (!inserted.error) break
      if ((inserted.error as unknown as { code?: string }).code !== '23505') break
    }
  }

  if (inserted.error) {
    console.error('[events/submit.post] DB error:', inserted.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  await notifyAdmin('event_submitted', {
    title,
    url: url || '',
    start_date: startDate,
    slug: inserted.data?.slug || slug
  })

  setResponseStatus(event, 201)
  return {
    submitted: true,
    message: 'Thanks! Your event will be reviewed and added shortly.'
  }
})
