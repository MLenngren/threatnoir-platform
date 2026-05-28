import { createError, defineEventHandler, getRouterParam } from 'h3'
import { TwitterApi } from 'twitter-api-v2'

import { requireAdminUser } from '../../../../utils/requireAdmin'

const X_USERNAME = (process.env.X_USERNAME || '').trim()

function requireEnv(name: string): string {
  const v = (process.env[name] || '').trim()
  if (!v) {
    throw createError({
      statusCode: 500,
      statusMessage: `Missing required env var: ${name}. Configure X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.`
    })
  }
  return v
}

export default defineEventHandler(async (event) => {
  const { supabase } = await requireAdminUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw new Error('Missing social draft id')

  const { data: draft, error: loadErr } = await supabase
    .from('social_drafts')
    .select('id,status,text_x')
    .eq('id', id)
    .single()

  if (loadErr) {
    console.error('[admin/social/[id]/approve.post] DB error (load):', loadErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  const status = (draft as Record<string, unknown>).status
  if (status === 'skipped') {
    throw createError({ statusCode: 400, statusMessage: 'Draft is skipped' })
  }

  const textX = typeof (draft as Record<string, unknown>).text_x === 'string' ? (draft as Record<string, unknown>).text_x.trim() : ''
  if (!textX) {
    throw createError({ statusCode: 400, statusMessage: 'Draft missing text_x' })
  }
  if (textX.length > 280) {
    throw createError({ statusCode: 400, statusMessage: 'text_x must be <= 280 characters' })
  }

  const client = new TwitterApi({
    appKey: requireEnv('X_CONSUMER_KEY'),
    appSecret: requireEnv('X_CONSUMER_SECRET'),
    accessToken: requireEnv('X_ACCESS_TOKEN'),
    accessSecret: requireEnv('X_ACCESS_TOKEN_SECRET')
  })

  const { data } = await client.v2.tweet(textX)
  const tweetUrl = `https://x.com/${X_USERNAME}/status/${data.id}`

  const { error: updateErr } = await supabase
    .from('social_drafts')
    .update({
      status: 'posted',
      posted_url: tweetUrl,
      posted_at: new Date().toISOString()
    })
    .eq('id', id)

  if (updateErr) {
    console.error('[admin/social/[id]/approve.post] DB error (update):', updateErr.message)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }

  return { posted_url: tweetUrl }
})
