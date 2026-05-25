/**
 * Send a welcome/test message to a newly added notification channel
 * so the user knows it's working.
 */

export async function sendChannelWelcome(
  channelType: string,
  channelConfig: Record<string, unknown>
): Promise<void> {
  try {
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
              '🔒 *ThreatNoir connected*',
              '',
              'This channel is now linked to your ThreatNoir subscription\\.',
              'You will receive security alerts here based on your preferences\\.',
              '',
              'Manage your subscription at [threatnoir\\.com/settings](https://threatnoir.com/settings)',
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
                title: '🔒 ThreatNoir connected',
                description:
                  'This channel is now linked to your ThreatNoir subscription. You will receive security alerts here based on your preferences.',
                color: 0x06b6d4,
                footer: { text: 'Manage at threatnoir.com/settings' },
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
            message: 'ThreatNoir webhook connected. You will receive security alerts at this endpoint.',
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
