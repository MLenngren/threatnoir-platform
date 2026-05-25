import { createError, defineEventHandler, readBody } from 'h3'

import { requireSubscriber } from '../../utils/requireSubscriber'
import { normalizeText } from '../../utils/subscriptions'

type Body = {
  name?: unknown
}

export default defineEventHandler(async (event) => {
  const { supabase, subscriber } = await requireSubscriber(event)
  const body = await readBody<Body>(event)

  const nameRaw = typeof body?.name === 'string' ? body.name : ''
  const name = normalizeText(nameRaw, 100) || null

  const res = await supabase
    .from('subscribers')
    .update({ name })
    .eq('id', subscriber.id)
    .select('id,email,name,verified')
    .single()

  if (res.error) {
    console.error('[settings/profile.put] DB error:', res.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { subscriber: res.data }
})
