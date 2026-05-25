import { createError, defineEventHandler, readBody } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit, getClientIP } from '../../utils/rateLimit'
import { EMAIL_REGEX, normalizeEmail, normalizeText } from '../../utils/subscriptions'

type Body = {
  email?: string
  company?: string
  use_case?: string
}

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`subscribe:api-request:${ip}`, 5, 60 * 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const body = await readBody<Body>(event)
  const email = normalizeEmail(body?.email)
  if (!email || !EMAIL_REGEX.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  const company = normalizeText(body?.company, 200) || null
  const useCase = normalizeText(body?.use_case, 2000) || null

  const supabase = serverSupabaseServiceRole(event)
  const { error } = await supabase.from('api_requests').insert({
    email,
    company,
    use_case: useCase
  })

  if (error) {
    console.error('[subscribe/api-request.post] DB error:', error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { success: true, message: "We'll review your request and contact you" }
})
