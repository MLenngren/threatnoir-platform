import { createError, defineEventHandler } from 'h3'

import { requireSubscriber } from '../../utils/requireSubscriber'

export default defineEventHandler(async (event) => {
  const { supabase, subscriber } = await requireSubscriber(event)

  const [prefsDel, channelsDel] = await Promise.all([
    supabase.from('subscriber_preferences').delete().eq('subscriber_id', subscriber.id),
    supabase.from('subscriber_channels').delete().eq('subscriber_id', subscriber.id)
  ])

  if (prefsDel.error) {
    console.error('[settings/unsubscribe.post] DB error (delete prefs):', prefsDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (channelsDel.error) {
    console.error('[settings/unsubscribe.post] DB error (delete channels):', channelsDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { success: true }
})
