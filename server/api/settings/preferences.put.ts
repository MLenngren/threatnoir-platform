import { createError, defineEventHandler, readBody } from 'h3'

import { requireSubscriber } from '../../utils/requireSubscriber'
import { normalizeText } from '../../utils/subscriptions'

const VALID_TYPES = new Set(['category', 'regulation', 'jurisdiction', 'company', 'industry', 'freetext'])

type PrefInput = { preference_type?: unknown; preference_value?: unknown }
type Body = { preferences?: unknown } | unknown

export default defineEventHandler(async (event) => {
  const { supabase, subscriber } = await requireSubscriber(event)
  const body = (await readBody<Body>(event)) as unknown

  const rawList = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { preferences?: unknown }).preferences)
      ? (body as { preferences: unknown[] }).preferences
      : null

  if (!rawList) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid preferences payload' })
  }

  const next: Array<{ subscriber_id: string; preference_type: string; preference_value: string }> = []
  const seen = new Set<string>()

  for (const item of rawList as PrefInput[]) {
    const type = typeof item?.preference_type === 'string' ? item.preference_type.trim() : ''
    if (!VALID_TYPES.has(type)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid preference_type' })
    }

    let value = normalizeText(item?.preference_value, 200)
    if (!value) continue
    if (type === 'category') value = value.toLowerCase()

    const key = `${type}:${value.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    next.push({ subscriber_id: subscriber.id, preference_type: type, preference_value: value })
  }

  const delRes = await supabase.from('subscriber_preferences').delete().eq('subscriber_id', subscriber.id)
  if (delRes.error) {
    console.error('[settings/preferences.put] DB error (delete prefs):', delRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  if (next.length) {
    const insRes = await supabase.from('subscriber_preferences').insert(next)
    if (insRes.error) {
      console.error('[settings/preferences.put] DB error (insert prefs):', insRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
  }

  return { success: true }
})
