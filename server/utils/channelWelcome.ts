/**
 * Send a welcome/test message to a newly added notification channel
 * so the user knows it's working.
 */

import { getSiteConfig } from './siteConfig'

// eslint-disable-next-line no-useless-escape
const escMarkdownV2 = (s: string) => s.replace(/([_*\[\]\(\)~`>#+\-=|{}.!])/g, '\\$1')

export async function sendChannelWelcome(
  channelType: string,
  channelConfig: Record<string, unknown>
): Promise<void> {
  try {
	    const site = getSiteConfig()
	    const settingsUrl = `${site.url}/settings`
    switch (channelType) {
      case 'telegram': {
        const chatId = String(channelConfig.chat_id || channelConfig.telegram_chat_id || '')
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (!chatId || !botToken) return

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: [
	              `🔒 ${escMarkdownV2(site.name)} connected`,
              '',
	              `This channel is now linked to your ${escMarkdownV2(site.name)} subscription\\.`,
              'You will receive security alerts here based on your preferences\\.',
              '',
	              `Manage your subscription at ${escMarkdownV2(settingsUrl)}`,
            ].join('\n'),
            parse_mode: 'MarkdownV2',
          }),
        })
        break
      }

      case 'discord': {
        const webhookUrl = String(channelConfig.webhook_url || channelConfig.discord_webhook_url || '')
        if (!webhookUrl) return

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
	                title: `🔒 ${site.name} connected`,
                description:
	                  `This channel is now linked to your ${site.name} subscription. You will receive security alerts here based on your preferences.`,
                color: 0x06b6d4,
	                footer: { text: `Manage at ${settingsUrl.replace(/^https?:\/\//, '')}` },
              },
            ],
          }),
        })
        break
      }

      case 'webhook': {
        const endpointUrl = String(channelConfig.endpoint_url || channelConfig.webhook_endpoint_url || '')
        if (!endpointUrl) return

        await fetch(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'channel_connected',
	            message: `${site.name} webhook connected. You will receive security alerts at this endpoint.`,
          }),
        })
        break
      }

      case 'email': {
        // Email verification already handles this — no extra welcome needed
        break
      }

      default:
        break
    }
  } catch (err) {
    // Don't fail the subscription if welcome message fails
    console.error(`[channelWelcome] Failed to send welcome to ${channelType}:`, err)
  }
}
