import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { randomUUID } from 'node:crypto'

import { serverSupabaseServiceRole } from '#supabase/server'
import { sendChannelWelcome } from '../utils/channelWelcome'
import { checkRateLimit, getClientIP } from '../utils/rateLimit'
import { sendVerificationEmail } from '../utils/resend'
import { getAuthUser } from '../utils/getAuthUser'
import {
  EMAIL_REGEX,
  normalizeEmail,
  normalizeInterests,
  normalizeText,
  preferencesFromInterests
} from '../utils/subscriptions'

type Body = {
  email?: string
  name?: string
  interests?: unknown
  preferences?: unknown
  channel?: {
    type?: string
    config?: unknown
    discord_webhook_url?: string
    telegram_chat_id?: string
    webhook_endpoint_url?: string
  }
}

const VALID_CHANNEL_TYPES = new Set(['email', 'discord', 'telegram', 'webhook', 'api'])

export default defineEventHandler(async (event) => {
  const ip = getClientIP(event)
  const { allowed } = checkRateLimit(`subscribe:${ip}`, 10, 60 * 60_000)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const body = await readBody<Body>(event)

  // Check if user is authenticated (server-side trust for email + auto-verify)
  let isAuthenticated = false
  let email: string | null = null
  const user = await getAuthUser(event)
  if (user?.email) {
    email = normalizeEmail(user.email)
    isAuthenticated = true
  }
  if (!email) {
    email = normalizeEmail(body?.email)
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email' })
  }

  const name = normalizeText(body?.name, 100) || null

  const channelType = typeof body?.channel?.type === 'string'
    ? body.channel.type.trim().slice(0, 20)
    : 'email'
  if (!VALID_CHANNEL_TYPES.has(channelType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid channel type' })
  }

  // Build channel config with strict validation per type — no arbitrary config objects
  const channelConfig: Record<string, string> = {}

  if (channelType === 'discord') {
    const url = typeof body?.channel?.discord_webhook_url === 'string'
      ? body.channel.discord_webhook_url.trim().slice(0, 500)
      : ''
    // Must be a Discord webhook URL
    if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid Discord webhook URL' })
    }
    channelConfig.webhook_url = url
  }

  if (channelType === 'telegram') {
    const chatId = typeof body?.channel?.telegram_chat_id === 'string'
      ? body.channel.telegram_chat_id.trim().slice(0, 20)
      : ''
    // Must be numeric (positive or negative for groups)
    if (!chatId || !/^-?\d+$/.test(chatId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid Telegram chat ID' })
    }
    channelConfig.chat_id = chatId
  }

  if (channelType === 'webhook') {
    const url = typeof body?.channel?.webhook_endpoint_url === 'string'
      ? body.channel.webhook_endpoint_url.trim().slice(0, 500)
      : ''
    // Must be HTTPS (no HTTP, no internal IPs — basic SSRF protection)
    if (!url || !url.startsWith('https://')) {
      throw createError({ statusCode: 400, statusMessage: 'Webhook URL must use HTTPS' })
    }
    // Block internal/private ranges
    const hostname = new URL(url).hostname
    if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid webhook URL' })
    }
    channelConfig.endpoint_url = url
  }

  // Accept both "interests" and "preferences" field names from the form
  const interests = normalizeInterests(body?.interests ?? body?.preferences)

  const supabase = serverSupabaseServiceRole(event)

  const existingRes = await supabase
    .from('subscribers')
    .select('id,verify_token,verified')
    .eq('email', email)
    .maybeSingle()

  if (existingRes.error) {
    console.error('[subscribe.post] DB error (lookup):', existingRes.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  let subscriberId: string
  let verifyToken: string
  let alreadyVerified = false
	  let isNewSubscriber = false

  if (existingRes.data) {
    subscriberId = existingRes.data.id
    verifyToken = (existingRes.data.verify_token ?? '').trim() || randomUUID()
    alreadyVerified = Boolean(existingRes.data.verified)

    const patch: Record<string, unknown> = {}
    if (!existingRes.data.verify_token) patch.verify_token = verifyToken
    if (name) patch.name = name
    if (Object.keys(patch).length) {
      const { error: updateErr } = await supabase.from('subscribers').update(patch).eq('id', subscriberId)
      if (updateErr) {
        console.error('[subscribe.post] DB error (update subscriber):', updateErr.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }
    }
  } else {
    verifyToken = randomUUID()

    const insertRes = await supabase
      .from('subscribers')
      .insert({ email, name, verify_token: verifyToken })
      .select('id,verify_token,verified')
      .single()

    if (insertRes.error) {
      // Handle race: unique(email) violation
      if ((insertRes.error as { code?: string }).code === '23505') {
        const dup = await supabase
          .from('subscribers')
          .select('id,verify_token,verified')
          .eq('email', email)
          .maybeSingle()
        if (dup.data) {
          subscriberId = dup.data.id
          verifyToken = (dup.data.verify_token ?? '').trim() || verifyToken
          alreadyVerified = Boolean(dup.data.verified)
        } else {
          console.error('[subscribe.post] DB error (dup lookup):', dup.error?.message ?? 'unknown')
          throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
        }
      } else {
        console.error('[subscribe.post] DB error (insert subscriber):', insertRes.error.message)
        throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
      }
    } else {
      subscriberId = insertRes.data.id
      verifyToken = (insertRes.data.verify_token ?? '').trim() || verifyToken
      alreadyVerified = Boolean(insertRes.data.verified)
	      isNewSubscriber = true
      setResponseStatus(event, 201)
    }
  }

		  // Schedule welcome sequence ONLY for brand new subscribers.
		  if (isNewSubscriber) {
		    const now = new Date()
		    const morningCET = (daysFromNow: number): string => {
		      const d = new Date()
		      d.setDate(d.getDate() + daysFromNow)
		      // Set to 08:00 UTC = 09:00 CET (10:00 CEST in summer, but close enough)
		      d.setUTCHours(8, 0, 0, 0)
		      return d.toISOString()
		    }
		
		    const { error: schedErr } = await supabase.from('scheduled_emails').insert([
		      { subscriber_id: subscriberId, template: 'welcome_day_0', scheduled_for: now.toISOString() },
		      { subscriber_id: subscriberId, template: 'welcome_day_2', scheduled_for: morningCET(2) },
		      { subscriber_id: subscriberId, template: 'welcome_day_5', scheduled_for: morningCET(5) },
		      { subscriber_id: subscriberId, template: 'welcome_day_10', scheduled_for: morningCET(10) }
		    ])
		    if (schedErr) {
		      console.error('[subscribe.post] DB error (schedule welcome):', schedErr.message)
		      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
		    }
		  }

  // Upsert behavior: clear + reinsert
  const [prefsDel, channelsDel] = await Promise.all([
    supabase.from('subscriber_preferences').delete().eq('subscriber_id', subscriberId),
    supabase.from('subscriber_channels').delete().eq('subscriber_id', subscriberId)
  ])
  if (prefsDel.error) {
    console.error('[subscribe.post] DB error (delete prefs):', prefsDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
  if (channelsDel.error) {
    console.error('[subscribe.post] DB error (delete channels):', channelsDel.error.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const prefs = preferencesFromInterests(subscriberId, interests)
  if (prefs.length) {
    const { error: prefErr } = await supabase.from('subscriber_preferences').insert(prefs)
    if (prefErr) {
      console.error('[subscribe.post] DB error (insert prefs):', prefErr.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
  }

  // If authenticated or already verified: auto-verify the channel
  const shouldAutoVerify = isAuthenticated || alreadyVerified

  const { error: chanErr } = await supabase.from('subscriber_channels').insert({
    subscriber_id: subscriberId,
    channel_type: channelType,
    channel_config: channelConfig,
    verified: shouldAutoVerify
  })
  if (chanErr) {
    console.error('[subscribe.post] DB error (insert channel):', chanErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  // Send welcome message to the new channel (non-blocking)
  if (channelType !== 'email') {
    sendChannelWelcome(channelType, channelConfig).catch(() => {})
  }

  // If authenticated: ensure subscriber + all channels are verified, no email needed
  if (isAuthenticated) {
    await supabase.from('subscribers').update({ verified: true }).eq('id', subscriberId)
    await supabase.from('subscriber_channels').update({ verified: true }).eq('subscriber_id', subscriberId)
    return { success: true, message: 'You are subscribed! Preferences saved.' }
  }

  // If already verified subscriber (returning, not logged in): just update, no email
  if (alreadyVerified) {
    return { success: true, message: 'Your subscription preferences have been updated' }
  }

  // Only case left: new unverified unauthenticated subscriber — send verification email
  try {
    await sendVerificationEmail(email, verifyToken)
  } catch (err) {
    console.error('[subscribe.post] Resend error:', err)
    throw createError({ statusCode: 500, statusMessage: 'Unable to send verification email' })
  }

  return { success: true, message: 'Check your email to verify your subscription' }
})
