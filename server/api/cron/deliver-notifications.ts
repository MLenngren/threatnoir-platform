import { createError, defineEventHandler, getHeader } from 'h3'
import type { H3Event } from 'h3'

import { safeCompare } from '../../utils/safeCompare'
import { useSupabaseAdmin } from '../../utils/supabase'
import { validateUrlSafe } from '../../utils/ssrf'
import { sendNotificationEmail, sendWelcomeEmail, type ArticleData } from '../../utils/resend'
import { formatWeeklyPost, postToMastodon } from '../../utils/mastodon'
import {
  renderWelcomeDay0,
  renderWelcomeDay2,
  renderWelcomeDay5,
  renderWelcomeDay10
} from '../../utils/email/welcomeSequence'

type ChannelType = 'email' | 'discord' | 'telegram' | 'webhook' | 'api' | 'x'

type PendingRow = {
  id: string
  subscriber_id: string
  article_id: string
  channel_type: ChannelType
  created_at: string
}

type SubscriberRow = {
  id: string
  email: string
  verify_token: string
  verified?: boolean
}

type ScheduledEmailRow = {
  id: string
  subscriber_id: string
  template: string
  scheduled_for: string
}

function cleanText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  if (!s) return ''
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`
}

async function gatherWelcomeGlobals(supabase: ReturnType<typeof useSupabaseAdmin>): Promise<{
  latestPodcastTitle: string | null
  latestWeeklyLabel: string | null
  latestWeeklySlug: string | null
  latestWeeklyTldr: string | null
  topAwarenessLessons: Array<{ title: string; slug: string; excerpt: string }>
}> {
  const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [podRes, weeklyRes, awarenessRes] = await Promise.all([
    supabase
      .from('podcast_episodes')
      .select('title,date,created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('weekly_roundups')
      .select('week_label,slug,tldr,published_at,created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('awareness_lessons')
      .select('slug,title,body,published_at,created_at')
      .eq('status', 'published')
      .gte('published_at', cutoffIso)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(3)
  ])

  if (podRes.error) throw new Error(`podcast query failed: ${podRes.error.message}`)
  if (weeklyRes.error) throw new Error(`weekly query failed: ${weeklyRes.error.message}`)
  if (awarenessRes.error) throw new Error(`awareness query failed: ${awarenessRes.error.message}`)

  const latestPodcastTitle = cleanText((podRes.data?.[0] as Record<string, unknown> | undefined)?.title, 200) || null

  const wk = weeklyRes.data?.[0] as Record<string, unknown> | undefined
  const latestWeeklyLabel = cleanText(wk?.week_label, 40) || null
  const latestWeeklySlug = cleanText(wk?.slug, 80) || null
  const latestWeeklyTldr = cleanText(wk?.tldr, 600) || null

  const topAwarenessLessons: Array<{ title: string; slug: string; excerpt: string }> = []
  for (const row of (awarenessRes.data ?? []) as Array<Record<string, unknown>>) {
    const slug = cleanText(row.slug, 120)
    const title = cleanText(row.title, 200)
    const excerpt = cleanText(row.body, 220)
    if (!slug || !title) continue
    topAwarenessLessons.push({ slug, title, excerpt: excerpt || '' })
  }

  return { latestPodcastTitle, latestWeeklyLabel, latestWeeklySlug, latestWeeklyTldr, topAwarenessLessons }
}

type SubscriberChannelRow = {
  subscriber_id: string
  channel_type: ChannelType
  channel_config: Record<string, unknown>
  is_active: boolean
  consecutive_failures: number
}

const requireCronSecret = (event: H3Event) => {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRON_SECRET is not configured'
    })
  }

  const headerSecret = getHeader(event, 'x-cron-secret')
  const auth = getHeader(event, 'authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]
  const provided = headerSecret || bearer

  if (!provided || !safeCompare(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

function key(subscriberId: string, channelType: string): string {
  return `${subscriberId}|${channelType}`
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function regulationColor(regulation: string | null | undefined): number {
  const r = (regulation || '').trim().toLowerCase()
  if (!r) return 0x6b7280

  if (r.includes('gdpr')) return 0x2563eb
  if (r.includes('nis2') || r.includes('nis 2')) return 0x7c3aed
  if (r.includes('hipaa')) return 0x10b981
  if (r.includes('pci')) return 0xf59e0b
  if (r.includes('ccpa') || r.includes('cpra')) return 0x06b6d4
  if (r.includes('dora')) return 0xef4444

  return 0x6b7280
}

function escapeTelegramMarkdownV2(input: string): string {
  // Telegram MarkdownV2 special chars:
  // _ * [ ] ( ) ~ ` > # + - = | { } . ! \
  const specials = new Set([
    '_',
    '*',
    '[',
    ']',
    '(',
    ')',
    '~',
    '`',
    '>',
    '#',
    '+',
    '-',
    '=',
    '|',
    '{',
    '}',
    '.',
    '!',
    '\\'
  ])

  let out = ''
  for (const ch of String(input || '')) {
    out += specials.has(ch) ? `\\${ch}` : ch
  }
  return out
}

function escapeTelegramMarkdownV2Url(input: string): string {
  // For URLs inside [text](url) we should avoid over-escaping.
  // Escape only characters that can break the link syntax.
  return (input || '').replace(/([()\\])/g, '\\$1')
}

function getConfigString(cfg: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = cfg?.[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

async function deliverDiscord(webhookUrl: string, article: ArticleData): Promise<void> {
  const url = (webhookUrl || '').trim()
  if (!url) throw new Error('Missing Discord webhook URL')
  await validateUrlSafe(url)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: article.brief || article.title,
          url: article.url,
          color: regulationColor(article.regulation),
          fields: [
            ...(article.regulation ? [{ name: 'Regulation', value: article.regulation, inline: true }] : []),
            ...(article.jurisdiction ? [{ name: 'Jurisdiction', value: article.jurisdiction, inline: true }] : []),
            ...(article.fine_amount ? [{ name: 'Fine', value: article.fine_amount, inline: true }] : [])
          ],
          footer: { text: 'ThreatNoir' },
          timestamp: article.published_at || new Date().toISOString()
        }
      ]
    })
  })

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 400)
    throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`)
  }
}

async function deliverTelegram(chatId: string, botToken: string, article: ArticleData): Promise<void> {
  const cid = (chatId || '').trim()
  if (!cid) throw new Error('Missing Telegram chat id')
  const token = (botToken || '').trim()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')

  const text = [
    `*${escapeTelegramMarkdownV2(article.brief || article.title)}*`,
    article.regulation ? `\uD83D\uDCCB ${escapeTelegramMarkdownV2(article.regulation)}` : '',
    article.jurisdiction ? `\uD83C\uDF0D ${escapeTelegramMarkdownV2(article.jurisdiction)}` : '',
    article.fine_amount ? `\uD83D\uDCB0 ${escapeTelegramMarkdownV2(article.fine_amount)}` : '',
    `[Read more](${escapeTelegramMarkdownV2Url(article.url)})`
  ]
    .filter(Boolean)
    .join('\n')

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: cid, text, parse_mode: 'MarkdownV2' })
  })

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 400)
    throw new Error(`Telegram sendMessage failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`)
  }
}

async function deliverWebhook(endpointUrl: string, article: ArticleData): Promise<void> {
  const url = (endpointUrl || '').trim()
  if (!url) throw new Error('Missing webhook endpoint URL')
  await validateUrlSafe(url)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'new_article',
      article: {
        id: article.id,
        title: article.title,
        brief: article.brief,
        url: article.url,
        regulation: article.regulation,
        jurisdiction: article.jurisdiction,
        fine_amount: article.fine_amount,
        published_at: article.published_at
      }
    })
  })

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 400)
    throw new Error(`Webhook delivery failed: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`)
  }
}

export default defineEventHandler(async (event) => {
  requireCronSecret(event)

  const supabase = useSupabaseAdmin()

  // ---------------------------------------------------------------------------
  // 1) Deliver pending notifications
  // ---------------------------------------------------------------------------

  let processed = 0
  let sent = 0
  let failed = 0
  let skipped = 0
  let disabled = 0

  const { data: pending, error: pendingError } = await supabase
    .from('notification_log')
    .select('id,subscriber_id,article_id,channel_type,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100)

  if (pendingError) {
    console.error('[cron/deliver] DB error (pending):', pendingError.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const rows = (pending ?? []) as unknown as PendingRow[]
  if (rows.length > 0) {
    const subscriberIds = Array.from(new Set(rows.map((r) => r.subscriber_id).filter(Boolean)))
    const articleIds = Array.from(new Set(rows.map((r) => r.article_id).filter(Boolean)))
    const channelTypes = Array.from(new Set(rows.map((r) => r.channel_type).filter(Boolean)))

    const [articlesRes, subsRes, channelsRes] = await Promise.all([
      supabase
        .from('articles')
        .select('id,title,brief,url,regulation,jurisdiction,fine_amount,published_at')
        .in('id', articleIds),
      supabase.from('subscribers').select('id,email,verify_token,verified').in('id', subscriberIds),
      supabase
        .from('subscriber_channels')
        .select('subscriber_id,channel_type,channel_config,is_active,consecutive_failures')
        .in('subscriber_id', subscriberIds)
        .in('channel_type', channelTypes)
        .eq('is_active', true)
    ])

    if (articlesRes.error) {
      console.error('[cron/deliver] DB error (articles):', articlesRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    if (subsRes.error) {
      console.error('[cron/deliver] DB error (subscribers):', subsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }
    if (channelsRes.error) {
      console.error('[cron/deliver] DB error (channels):', channelsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const articleById = new Map<string, ArticleData>()
    for (const a of (articlesRes.data ?? []) as unknown as ArticleData[]) {
      if (a?.id) articleById.set(a.id, a)
    }

    const subscriberById = new Map<string, SubscriberRow>()
    for (const s of (subsRes.data ?? []) as unknown as SubscriberRow[]) {
      if (s?.id) subscriberById.set(s.id, s)
    }

    const channelByKey = new Map<string, SubscriberChannelRow>()
    for (const c of (channelsRes.data ?? []) as unknown as SubscriberChannelRow[]) {
      if (!c?.subscriber_id || !c?.channel_type) continue
      channelByKey.set(key(c.subscriber_id, c.channel_type), {
        ...c,
        channel_config: (c.channel_config && typeof c.channel_config === 'object' ? c.channel_config : {}) as Record<string, unknown>,
        consecutive_failures: Number.isFinite(c.consecutive_failures) ? c.consecutive_failures : 0
      })
    }

    const telegramToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim()

    for (const n of rows) {
      const article = articleById.get(n.article_id)
      const sub = subscriberById.get(n.subscriber_id)
      const channel = channelByKey.get(key(n.subscriber_id, n.channel_type))

      if (!article || !sub) {
        skipped += 1
        await supabase
          .from('notification_log')
          .update({ status: 'failed', error_message: 'Missing article or subscriber', sent_at: null })
          .eq('id', n.id)
        failed += 1
        continue
      }

      if (!channel) {
        skipped += 1
        await supabase
          .from('notification_log')
          .update({ status: 'failed', error_message: 'Channel missing or inactive', sent_at: null })
          .eq('id', n.id)
        failed += 1
        continue
      }

      try {
        if (n.channel_type === 'email') {
          await sendNotificationEmail(sub.email, article, { subscriberId: sub.id, verifyToken: sub.verify_token })
        } else if (n.channel_type === 'discord') {
          const webhookUrl = getConfigString(channel.channel_config, [
            'discord_webhook_url',
            'webhook_url',
            'url',
            'webhookUrl'
          ])
          await deliverDiscord(webhookUrl, article)
        } else if (n.channel_type === 'telegram') {
          const chatId = getConfigString(channel.channel_config, ['telegram_chat_id', 'chat_id', 'chatId'])
          await deliverTelegram(chatId, telegramToken, article)
        } else if (n.channel_type === 'webhook') {
          const endpointUrl = getConfigString(channel.channel_config, [
            'webhook_endpoint_url',
            'endpoint_url',
            'url',
            'endpointUrl'
          ])
          await deliverWebhook(endpointUrl, article)
        } else {
          throw new Error(`Unsupported channel_type: ${n.channel_type}`)
        }

        const nowIso = new Date().toISOString()
        const [nl, ch] = await Promise.all([
          supabase
            .from('notification_log')
            .update({ status: 'sent', sent_at: nowIso, error_message: null })
            .eq('id', n.id),
          supabase
            .from('subscriber_channels')
            .update({ consecutive_failures: 0 })
            .eq('subscriber_id', n.subscriber_id)
            .eq('channel_type', n.channel_type)
        ])

        if (nl.error) console.warn('[cron/deliver] failed to update notification_log(sent):', nl.error.message)
        if (ch.error) console.warn('[cron/deliver] failed to reset consecutive_failures:', ch.error.message)

        channel.consecutive_failures = 0
        sent += 1
      } catch (err: unknown) {
        const msg = errorMessage(err)

        const nextFailures = (channel.consecutive_failures ?? 0) + 1
        const disableChannel = nextFailures >= 3

        const [nl, ch] = await Promise.all([
          supabase
            .from('notification_log')
            .update({ status: 'failed', sent_at: null, error_message: msg })
            .eq('id', n.id),
          supabase
            .from('subscriber_channels')
            .update({ consecutive_failures: nextFailures, is_active: disableChannel ? false : true })
            .eq('subscriber_id', n.subscriber_id)
            .eq('channel_type', n.channel_type)
        ])

        // Best-effort: log update failures but don't abort the batch.
        if (nl.error) console.warn('[cron/deliver] failed to update notification_log(failed):', nl.error.message)
        if (ch.error) console.warn('[cron/deliver] failed to update consecutive_failures:', ch.error.message)

        channel.consecutive_failures = nextFailures
        if (disableChannel && channel.is_active) {
          disabled += 1
          channel.is_active = false
        }
        failed += 1

        console.warn(`[cron/deliver] delivery failed (${n.channel_type}) for notification ${n.id}:`, msg)
      }
    }

    processed = rows.length
    console.log(`[deliver] processed ${processed} notifications: ${sent} sent, ${failed} failed, ${disabled} channel disabled`)
  }

  // ---------------------------------------------------------------------------
  // 2) Deliver scheduled welcome emails
  // ---------------------------------------------------------------------------

  let welcomeProcessed = 0
  let welcomeSent = 0
  let welcomeFailed = 0
  let welcomeSkipped = 0

  const { data: due, error: dueErr } = await supabase
    .from('scheduled_emails')
    .select('id,subscriber_id,template,scheduled_for')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (dueErr) {
    console.error('[cron/deliver] DB error (scheduled_emails):', dueErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const scheduled = (due ?? []) as unknown as ScheduledEmailRow[]
  if (scheduled.length > 0) {
    const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').trim() || 'https://threatnoir.com'
    const base = siteUrl.replace(/\/$/, '')
    const globals = await gatherWelcomeGlobals(supabase)

    const subscriberIds = Array.from(new Set(scheduled.map((r) => r.subscriber_id).filter(Boolean)))
    const subsRes = await supabase
      .from('subscribers')
      .select('id,email,verified,verify_token')
      .in('id', subscriberIds)

    if (subsRes.error) {
      console.error('[cron/deliver] DB error (welcome subscribers):', subsRes.error.message)
      throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
    }

    const subById = new Map<string, { id: string; email: string; verified: boolean; verify_token: string }>()
    for (const s of (subsRes.data ?? []) as Array<Record<string, unknown>>) {
      const id = typeof s.id === 'string' ? s.id : ''
      const email = typeof s.email === 'string' ? s.email : ''
      const verified = Boolean(s.verified)
      const token = typeof s.verify_token === 'string' ? s.verify_token : ''
      if (id) subById.set(id, { id, email, verified, verify_token: token })
    }

    for (const row of scheduled) {
      welcomeProcessed += 1
      const sub = subById.get(row.subscriber_id)
      if (!sub) {
        welcomeFailed += 1
        await supabase
          .from('scheduled_emails')
          .update({ status: 'failed', error: 'Missing subscriber' })
          .eq('id', row.id)
        continue
      }

      if (!sub.verified) {
        welcomeSkipped += 1
        await supabase
          .from('scheduled_emails')
          .update({ status: 'skipped', error: 'unverified' })
          .eq('id', row.id)
        continue
      }

      const token = (sub.verify_token || '').trim()
      if (!token) {
        welcomeFailed += 1
        await supabase
          .from('scheduled_emails')
          .update({ status: 'failed', error: 'Missing verify_token' })
          .eq('id', row.id)
        continue
      }

      const unsubscribeUrl = `${base}/api/subscribe/${encodeURIComponent(sub.id)}?token=${encodeURIComponent(token)}`
      const templateData = {
        email: sub.email,
        siteUrl: base,
        manageUrl: `${base}/subscribe`,
        unsubscribeUrl,
        latestPodcastTitle: globals.latestPodcastTitle,
        latestPodcastUrl: `${base}/podcast`,
        latestWeeklyLabel: globals.latestWeeklyLabel,
        latestWeeklySlug: globals.latestWeeklySlug,
        latestWeeklyTldr: globals.latestWeeklyTldr,
        topAwarenessLessons: globals.topAwarenessLessons
      }

      let rendered: { subject: string; html: string; text: string } | null = null
      if (row.template === 'welcome_day_0') rendered = renderWelcomeDay0(templateData)
      else if (row.template === 'welcome_day_2') rendered = renderWelcomeDay2(templateData)
      else if (row.template === 'welcome_day_5') rendered = renderWelcomeDay5(templateData)
      else if (row.template === 'welcome_day_10') rendered = renderWelcomeDay10(templateData)

      if (!rendered) {
        welcomeSkipped += 1
        await supabase
          .from('scheduled_emails')
          .update({ status: 'skipped', error: 'unknown template' })
          .eq('id', row.id)
        continue
      }

      try {
        await sendWelcomeEmail({
          to: sub.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text
        })

        await supabase
          .from('scheduled_emails')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
          .eq('id', row.id)
        welcomeSent += 1
      } catch (err: unknown) {
        const msg = errorMessage(err)
        console.error('[cron/deliver] welcome send error:', msg)
        await supabase
          .from('scheduled_emails')
          .update({ status: 'failed', error: msg })
          .eq('id', row.id)
        welcomeFailed += 1
      }
    }
  }

  // ---------------------------------------------------------------------------
	// 3) Weekly roundup: Mastodon auto-post (email notifications removed)
  // ---------------------------------------------------------------------------

  const { data: latestWeekly, error: latestWeeklyErr } = await supabase
    .from('weekly_roundups')
	  .select('id,slug,week_label,tldr,mastodon_posted_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)

  if (latestWeeklyErr) {
    console.error('[cron/deliver] DB error (latest weekly_roundups):', latestWeeklyErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

	const latest = (latestWeekly ?? [])[0] as
		| { id: string; slug: string; week_label: string; tldr: string | null; mastodon_posted_at?: string | null }
		| undefined

  if (latest?.slug) {
    const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://threatnoir.com').trim() || 'https://threatnoir.com'
    const base = siteUrl.replace(/\/$/, '')

		// Mastodon auto-post (best-effort, once per roundup)
		if (!latest.mastodon_posted_at) {
			try {
				const mastodonStatus = formatWeeklyPost({
					weekLabel: (latest.week_label || '').trim(),
					slug: latest.slug,
					tldr: (latest.tldr || '').trim(),
					siteUrl: base
				})
				const mastodonResult = await postToMastodon(mastodonStatus)
				if (mastodonResult) {
					const up = await supabase
						.from('weekly_roundups')
						.update({ mastodon_posted_at: new Date().toISOString() })
						.eq('id', latest.id)
						.is('mastodon_posted_at', null)
					if (up.error) {
						console.warn('[deliver] failed to set weekly_roundups.mastodon_posted_at:', up.error.message)
					}
					console.log(`[deliver] mastodon weekly post: ${mastodonResult.url || mastodonResult.id}`)
				}
			} catch (err) {
				console.warn('[deliver] mastodon weekly post failed:', err)
			}
		}
  }

  return {
    processed,
    sent,
    failed,
    disabled,
    skipped,
    welcome_processed: welcomeProcessed,
    welcome_sent: welcomeSent,
    welcome_failed: welcomeFailed,
	  welcome_skipped: welcomeSkipped,

	  // Backwards/for monitoring convenience
	  welcomeProcessed,
	  welcomeSent,
	  welcomeFailed,
		welcomeSkipped
  }
})
