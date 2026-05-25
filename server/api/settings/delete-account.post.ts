import { createError, defineEventHandler } from 'h3'

import { requireSubscriber } from '../../utils/requireSubscriber'

export default defineEventHandler(async (event) => {
  const { supabase, subscriber, user } = await requireSubscriber(event)

  // Best-effort cleanup of subscriber data first.
  const [logDel, prefsDel, channelsDel] = await Promise.all([
    supabase.from('notification_log').delete().eq('subscriber_id', subscriber.id),
    supabase.from('subscriber_preferences').delete().eq('subscriber_id', subscriber.id),
    supabase.from('subscriber_channels').delete().eq('subscriber_id', subscriber.id)
  ])

  if (logDel.error) {
    console.error('[settings/delete-account.post] DB error (delete notification_log):', logDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (prefsDel.error) {
    console.error('[settings/delete-account.post] DB error (delete prefs):', prefsDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (channelsDel.error) {
    console.error('[settings/delete-account.post] DB error (delete channels):', channelsDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const subDel = await supabase.from('subscribers').delete().eq('id', subscriber.id)
  if (subDel.error) {
    console.error('[settings/delete-account.post] DB error (delete subscriber):', subDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const authDel = await supabase.auth.admin.deleteUser(user.id)
  if (authDel.error) {
    console.error('[settings/delete-account.post] Supabase auth error:', authDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Unable to delete account' })
  }

  return { success: true }
})
