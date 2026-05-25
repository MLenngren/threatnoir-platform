import { createError, type H3Event } from 'h3'
import { randomUUID } from 'node:crypto'

import { serverSupabaseServiceRole } from '#supabase/server'
import { EMAIL_REGEX, normalizeEmail } from './subscriptions'
import { getAuthUser } from './getAuthUser'

type SubscriberRow = {
  id: string
  email: string
  name: string | null
  verified: boolean
}

export async function requireSubscriber(event: H3Event) {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const email = normalizeEmail(user.email ?? '')
  if (!email || !EMAIL_REGEX.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid email' })
  }

  const supabase = serverSupabaseServiceRole(event)

  // Blocked users cannot access authenticated subscriber routes
  const profileRes = await supabase
    .from('profiles')
    .select('is_blocked')
    .eq('user_id', user.id)
    .maybeSingle<{ is_blocked: boolean }>()

  if (profileRes.error) {
    console.error('[requireSubscriber] DB error (profiles):', profileRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (profileRes.data?.is_blocked) {
    throw createError({ statusCode: 403, statusMessage: 'User is blocked' })
  }

  const existing = await supabase
    .from('subscribers')
    .select('id,email,name,verified')
    .eq('email', email)
    .maybeSingle<SubscriberRow>()

  if (existing.error) {
    console.error('[requireSubscriber] DB error (lookup):', existing.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (existing.data) {
    return { user, supabase, subscriber: existing.data }
  }

  // If the user is authenticated in Supabase Auth but doesn't exist in `subscribers` yet,
  // create an entry (mirrors /api/auth/ensure-subscriber behavior).
  const insertRes = await supabase
    .from('subscribers')
    .insert({
      email,
      verified: true,
      verify_token: randomUUID()
    })
    .select('id,email,name,verified')
    .single<SubscriberRow>()

  if (insertRes.error) {
    // Handle race: unique(email) violation
    if ((insertRes.error as { code?: string }).code === '23505') {
      const dup = await supabase
        .from('subscribers')
        .select('id,email,name,verified')
        .eq('email', email)
        .maybeSingle<SubscriberRow>()

      if (dup.error) {
        console.error('[requireSubscriber] DB error (dup lookup):', dup.error.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }
      if (!dup.data) {
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }
      return { user, supabase, subscriber: dup.data }
    }

    console.error('[requireSubscriber] DB error (insert):', insertRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { user, supabase, subscriber: insertRes.data }
}
