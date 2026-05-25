import { createError, defineEventHandler, getRouterParam } from 'h3'

import { requireSubscriber } from '../../../utils/requireSubscriber'
import { UUID_REGEX } from '../../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const { supabase, subscriber } = await requireSubscriber(event)
  const id = (getRouterParam(event, 'id') || '').trim()
  if (!id || !UUID_REGEX.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid channel id' })
  }

  const lookup = await supabase
    .from('subscriber_channels')
    .select('id')
    .eq('id', id)
    .eq('subscriber_id', subscriber.id)
    .maybeSingle()

  if (lookup.error) {
    console.error('[settings/channels/[id].delete] DB error (lookup):', lookup.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (!lookup.data) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const delRes = await supabase.from('subscriber_channels').delete().eq('id', id).eq('subscriber_id', subscriber.id)
  if (delRes.error) {
    console.error('[settings/channels/[id].delete] DB error (delete):', delRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { success: true }
})
