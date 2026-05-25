import { createError, defineEventHandler, readBody } from 'h3'

import { requireAdminUser } from '../../../utils/requireAdmin'

export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET is not configured' })
  }

  // Forward optional article_ids from admin request.
  let body: Record<string, unknown> | undefined
  try {
    const raw = await readBody(event)
    if (raw && Array.isArray(raw.article_ids) && raw.article_ids.length > 0) {
      body = { article_ids: raw.article_ids }
    }
  } catch {
    // No body — fine.
  }

  // Call cron endpoint server-side so we never expose the cron secret to the client.
  const fetchOpts: Record<string, unknown> = {
    method: 'POST',
    headers: { 'x-cron-secret': secret }
  }
  if (body) fetchOpts.body = body

  const res = await $fetch('/api/cron/generate-social-posts', fetchOpts)

  return res
})
