import { createError, defineEventHandler, readBody } from 'h3'
import { randomUUID } from 'node:crypto'

import { sendChannelWelcome } from '../../utils/channelWelcome'
import { requireSubscriber } from '../../utils/requireSubscriber'
import { normalizeText } from '../../utils/subscriptions'

const VALID_TYPES = new Set(['email', 'discord', 'telegram', 'webhook', 'api'])

type Body = {
  channel_type?: unknown
  channel_config?: unknown
  is_active?: unknown
}

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const { supabase, subscriber } = await requireSubscriber(event)
  const body = await readBody<Body>(event)

  const channelType = typeof body?.channel_type === 'string' ? body.channel_type.trim() : ''
  if (!VALID_TYPES.has(channelType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid channel_type' })
  }

  const active = typeof body?.is_active === 'boolean' ? body.is_active : true
  const cfgRaw = body?.channel_config
  const cfg = cfgRaw && typeof cfgRaw === 'object' && !Array.isArray(cfgRaw) ? (cfgRaw as Record<string, unknown>) : {}

  let channelConfig: Record<string, unknown> = {}
  if (channelType === 'email') {
    channelConfig = {}
  } else if (channelType === 'discord') {
    const url = normalizeText(cfg.discord_webhook_url, 400)
    if (!url || !isHttpsUrl(url)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid discord_webhook_url' })
    }
    channelConfig = { discord_webhook_url: url }
  } else if (channelType === 'telegram') {
    const chatId = normalizeText(cfg.telegram_chat_id, 100)
    if (!chatId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid telegram_chat_id' })
    }
    channelConfig = { telegram_chat_id: chatId }
  } else if (channelType === 'webhook') {
    const url = normalizeText(cfg.webhook_endpoint_url, 400)
    if (!url || !isHttpsUrl(url)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid webhook_endpoint_url' })
    }
    channelConfig = { webhook_endpoint_url: url }
  } else if (channelType === 'api') {
    channelConfig = { api_key: randomUUID() }
  }

  const res = await supabase
    .from('subscriber_channels')
    .insert({
      subscriber_id: subscriber.id,
      channel_type: channelType,
      channel_config: channelConfig,
      is_active: active,
      verified: true
    })
    .select('id,channel_type,channel_config,is_active,verified,consecutive_failures')
    .single()

  if (res.error) {
    console.error('[settings/channels.post] DB error:', res.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Send welcome message to the new channel (non-blocking)
  // channelWelcome handles both key naming conventions
  if (channelType !== 'email') {
    sendChannelWelcome(channelType, channelConfig).catch(() => {})
  }

  return res.data
})
