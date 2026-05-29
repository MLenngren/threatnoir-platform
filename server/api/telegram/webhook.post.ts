import { defineEventHandler, readBody } from 'h3'
import { getSiteConfig } from '../../utils/siteConfig'

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: {
      id?: number | string
    }
  }
}

export default defineEventHandler(async (event) => {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  if (!botToken) return { ok: true }

  const body = await readBody<TelegramUpdate>(event)

  // Telegram sends updates as JSON with a message object
  const message = body?.message
  if (!message) return { ok: true }

  const chatId = message.chat?.id
  const text = (message.text || '').trim()

  if (chatId === null || chatId === undefined) return { ok: true }

  // Only respond to /start
  if (text === '/start') {
	  const site = getSiteConfig()
	  const subscribeUrl = `${site.url}/subscribe`
    const replyText = [
	    `👋 Welcome to ${site.name} Alerts!`,
      '',
      `Your Chat ID is: \`${chatId}\``,
      '',
      'To receive notifications:',
	    `1. Go to ${subscribeUrl}`,
      '2. Choose "Telegram" as your notification channel',
      `3. Enter your Chat ID: \`${chatId}\``,
      '4. Select your interests and subscribe!',
      '',
      "You'll receive alerts for matching security articles directly here."
    ].join('\n')

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          parse_mode: 'Markdown'
        })
      })
    } catch (err) {
      console.error('[telegram/webhook.post] sendMessage failed:', err)
    }
  }

  // Always return 200 OK to Telegram (otherwise it retries)
  return { ok: true }
})
