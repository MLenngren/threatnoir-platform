import { defineEventHandler, createError } from 'h3'

import { requireSubscriber } from '../utils/requireSubscriber'

type SettingsResponse = {
  subscriber: { id: string; email: string; name: string | null; verified: boolean }
  preferences: Array<{ preference_type: string; preference_value: string }>
  channels: Array<{
    id: string
    channel_type: string
    channel_config: unknown
    is_active: boolean
    verified: boolean
    consecutive_failures: number | null
  }>
  notifications: Array<{
    id: string
    article_title: string | null
    article_url: string | null
    channel_type: string
    status: string
    sent_at: string
  }>
}

export default defineEventHandler(async (event): Promise<SettingsResponse> => {
  const { supabase, subscriber } = await requireSubscriber(event)

  const [prefsRes, channelsRes, notificationsRes] = await Promise.all([
    supabase
      .from('subscriber_preferences')
      .select('preference_type,preference_value')
      .eq('subscriber_id', subscriber.id)
      .order('preference_type', { ascending: true })
      .order('preference_value', { ascending: true }),
    supabase
      .from('subscriber_channels')
      .select('id,channel_type,channel_config,is_active,verified,consecutive_failures')
      .eq('subscriber_id', subscriber.id)
      .order('channel_type', { ascending: true }),
    supabase
      .from('notification_log')
      .select('id,channel_type,status,sent_at,article:articles(title,url)')
      .eq('subscriber_id', subscriber.id)
      .order('sent_at', { ascending: false })
      .limit(20)
  ])

  if (prefsRes.error) {
    console.error('[settings.get] DB error (prefs):', prefsRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (channelsRes.error) {
    console.error('[settings.get] DB error (channels):', channelsRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (notificationsRes.error) {
    console.error('[settings.get] DB error (notifications):', notificationsRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const notifications = (notificationsRes.data ?? []).map((n) => {
    const article = (n as unknown as { article?: { title?: string | null; url?: string | null } }).article
    return {
      id: (n as { id: string }).id,
      article_title: article?.title ?? null,
      article_url: article?.url ?? null,
      channel_type: (n as { channel_type: string }).channel_type,
      status: (n as { status: string }).status,
      sent_at: (n as { sent_at: string }).sent_at
    }
  })

  return {
    subscriber: {
      id: subscriber.id,
      email: subscriber.email,
      name: subscriber.name,
      verified: !!subscriber.verified
    },
    preferences: prefsRes.data ?? [],
    channels: channelsRes.data ?? [],
    notifications
  }
})
