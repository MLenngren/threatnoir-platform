const DISCORD_API = 'https://discord.com/api/v10'

function alertsChannelId(): string {
  return (process.env.DISCORD_ALERTS_CHANNEL_ID || '').trim()
}

/**
 * Send an ops message to a Discord channel (defined by DISCORD_ALERTS_CHANNEL_ID).
 * Non-blocking: failures are logged but never thrown. Skips if env not configured.
 */
export async function pingOps(content: string): Promise<void> {
  const token = (process.env.DISCORD_BOT_TOKEN || '').trim()
  const channelId = alertsChannelId()
  if (!token || !channelId) {
    console.warn('[discordOps] DISCORD_BOT_TOKEN or DISCORD_ALERTS_CHANNEL_ID not set, skipping ping')
    return
  }

  try {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: content.slice(0, 1900) })
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[discordOps] ping failed: ${res.status} ${body.slice(0, 200)}`)
    }
  } catch (err) {
    console.warn('[discordOps] ping exception:', err instanceof Error ? err.message : err)
  }
}
