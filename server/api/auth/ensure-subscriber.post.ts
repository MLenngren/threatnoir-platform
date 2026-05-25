import { createError, defineEventHandler } from 'h3'
import { randomUUID } from 'node:crypto'

import { serverSupabaseServiceRole } from '#supabase/server'
import { EMAIL_REGEX, normalizeEmail } from '../../utils/subscriptions'
import { getAuthUser } from '../../utils/getAuthUser'
import { notifyAdmin } from '../../utils/notifyAdmin'

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const email = normalizeEmail(user.email ?? '')
  if (!email || !EMAIL_REGEX.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid email' })
  }

  const supabase = serverSupabaseServiceRole(event)

  const existing = await supabase
    .from('subscribers')
    .select('id,verified')
    .eq('email', email)
    .maybeSingle()

  if (existing.error) {
    console.error('[auth/ensure-subscriber] DB error (lookup):', existing.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (existing.data) {
    if (!existing.data.verified) {
      const { error: updateErr } = await supabase
        .from('subscribers')
        .update({ verified: true })
        .eq('id', existing.data.id)

      if (updateErr) {
        console.error('[auth/ensure-subscriber] DB error (verify):', updateErr.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }
    }

    return { subscriberId: existing.data.id }
  }

  const insertRes = await supabase
    .from('subscribers')
    .insert({
      email,
      verified: true,
      verify_token: randomUUID()
    })
    .select('id')
    .single()

  if (insertRes.error) {
    // Handle race: unique(email) violation
    if ((insertRes.error as { code?: string }).code === '23505') {
      const dup = await supabase.from('subscribers').select('id').eq('email', email).maybeSingle()
      if (dup.error || !dup.data) {
        console.error('[auth/ensure-subscriber] DB error (dup lookup):', dup.error?.message ?? 'unknown')
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }
      return { subscriberId: dup.data.id }
    }

    console.error('[auth/ensure-subscriber] DB error (insert):', insertRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  notifyAdmin('user_signup', {
    email,
    timestamp: new Date().toISOString()
  }).catch(() => {})

	// Schedule welcome sequence (new verified subscriber)
	try {
	  const subscriberId = insertRes.data.id
	  const now = new Date()
	  const MS = 1000 * 60 * 60 * 24
	  const { error: schedErr } = await supabase.from('scheduled_emails').insert([
	    { subscriber_id: subscriberId, template: 'welcome_day_0', scheduled_for: now.toISOString() },
	    { subscriber_id: subscriberId, template: 'welcome_day_2', scheduled_for: new Date(now.getTime() + 2 * MS).toISOString() },
	    { subscriber_id: subscriberId, template: 'welcome_day_5', scheduled_for: new Date(now.getTime() + 5 * MS).toISOString() },
	    { subscriber_id: subscriberId, template: 'welcome_day_10', scheduled_for: new Date(now.getTime() + 10 * MS).toISOString() }
	  ])
	  if (schedErr) {
	    console.error('[auth/ensure-subscriber] DB error (schedule welcome):', schedErr.message)
	    throw new Error('schedule_failed')
	  }
	} catch {
	  throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
	}

  return { subscriberId: insertRes.data.id }
})

