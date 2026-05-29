#!/usr/bin/env node
/*
  Usage:
    npx tsx scripts/approve-api-request.ts <api_request_id>

  Approves an API access request by:
  - Fetching api_requests row
  - Finding or creating subscriber
  - Creating an 'api' subscriber_channel with a generated API key
  - Marking api_requests.status='approved'
  - Emailing the API key via Resend
*/

import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { Resend } from 'resend'

import { generateSubscriberApiKey } from '../server/utils/api-keys'
import { DEFAULT_SITE_URL } from '../shared/siteDefaults'

const SUPABASE_REF = process.env.SUPABASE_PROJECT_REF
if (!SUPABASE_REF) throw new Error('SUPABASE_PROJECT_REF env var required')
const SUPABASE_QUERY_URL = `https://api.supabase.com/v1/projects/${SUPABASE_REF}/database/query`

function eprint(...args: unknown[]) {
  console.error(...args)
}

function sqlLiteral(value: string | null): string {
  if (value === null) return 'NULL'
  // Avoid control-char regex to keep eslint happy
  const v = String(value).replaceAll('\u0000', '')
  return `'${v.replace(/'/g, "''")}'`
}

function getSupabasePat(): string {
  const env = (process.env.SUPABASE_PAT || '').trim()
  if (env) return env

  // Fallback to 1Password CLI if available (same convention as python backfill scripts)
  try {
    return execSync(['op', 'read', 'op://Claude/Supabase/PAT'].join(' '), { encoding: 'utf8' }).trim()
  } catch {
    throw new Error('Missing SUPABASE_PAT env var (or 1Password CLI not available)')
  }
}

function getResendApiKey(): string {
  const env = (process.env.RESEND_API_KEY || '').trim()
  if (!env) {
    throw new Error('Missing RESEND_API_KEY env var')
  }
  return env
}

function extractRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((r) => r && typeof r === 'object') as Array<Record<string, unknown>>
  }
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  for (const key of ['result', 'rows', 'data']) {
    const val = obj[key]
    if (Array.isArray(val)) {
      return val.filter((r) => r && typeof r === 'object') as Array<Record<string, unknown>>
    }
  }
  return []
}

async function runQuery(pat: string, query: string): Promise<unknown> {
  const res = await fetch(SUPABASE_QUERY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Supabase Management API query failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ''}`)
  }

  return res.json()
}

async function main(): Promise<void> {
  const requestId = (process.argv[2] || '').trim()
  if (!requestId) {
    throw new Error('Usage: npx tsx scripts/approve-api-request.ts <api_request_id>')
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(requestId)) {
    throw new Error('api_request_id must be a UUID')
  }

  const pat = getSupabasePat()

  eprint(`[approve-api-request] fetching api_requests id=${requestId}`)
  const reqPayload = await runQuery(
    pat,
    `select id,email,company,use_case,status,created_at from public.api_requests where id=${sqlLiteral(requestId)} limit 1;`
  )
  const reqRows = extractRows(reqPayload)
  const req = reqRows[0] || null
  if (!req) {
    throw new Error('api_requests row not found')
  }

  const email = typeof req.email === 'string' ? req.email.trim().toLowerCase() : ''
  const status = typeof req.status === 'string' ? req.status.trim().toLowerCase() : ''
  if (!email) {
    throw new Error('api_requests.email is missing')
  }
  if (status !== 'pending') {
    throw new Error(`api_requests.status must be 'pending' (got ${JSON.stringify(status)})`)
  }

  // Find or create subscriber
  eprint(`[approve-api-request] finding subscriber for ${email}`)
  const subPayload = await runQuery(
    pat,
    `select id,verified from public.subscribers where email=${sqlLiteral(email)} limit 1;`
  )
  const subRows = extractRows(subPayload)

  let subscriberId: string
  if (subRows[0]?.id && typeof subRows[0].id === 'string') {
    subscriberId = subRows[0].id
  } else {
    const token = randomUUID()
    eprint(`[approve-api-request] creating subscriber for ${email}`)
    const insPayload = await runQuery(
      pat,
      `insert into public.subscribers (email, verified, verify_token) values (${sqlLiteral(email)}, true, ${sqlLiteral(token)}) returning id;`
    )
    const insRows = extractRows(insPayload)
    const id = insRows[0]?.id
    if (typeof id !== 'string' || !id) throw new Error('Failed to create subscriber')
    subscriberId = id
  }


  const apiKey = generateSubscriberApiKey()

  // Create subscriber channel
  eprint(`[approve-api-request] inserting subscriber_channels api for subscriber=${subscriberId}`)
  const chanPayload = await runQuery(
    pat,
    `insert into public.subscriber_channels (subscriber_id, channel_type, channel_config, is_active, verified)
     values (${sqlLiteral(subscriberId)}, 'api'::public.channel_type, ${sqlLiteral(JSON.stringify({ api_key: apiKey }))}::jsonb, true, true)
     returning id;`
  )
  const chanRows = extractRows(chanPayload)
  const channelId = chanRows[0]?.id
  if (typeof channelId !== 'string' || !channelId) {
    throw new Error('Failed to create subscriber_channels row')
  }

  // Mark request approved
  eprint(`[approve-api-request] updating api_requests status=approved`)
  await runQuery(
    pat,
    `update public.api_requests set status='approved' where id=${sqlLiteral(requestId)};`
  )

  // Email API key
  const resend = new Resend(getResendApiKey())
	  const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL
  const endpoint = `${siteUrl.replace(/\/$/, '')}/api/v1/notifications`

  eprint(`[approve-api-request] sending API key email via Resend to=${email}`)
  await resend.emails.send({
    from: 'ThreatNoir <noreply@threatnoir.com>',
    to: email,
    subject: 'Your ThreatNoir API access is approved',
    html:
      `<p>Your ThreatNoir API access request has been approved.</p>` +
      `<p><strong>API key:</strong> <code>${apiKey}</code></p>` +
      `<p><strong>Endpoint:</strong> <code>${endpoint}?key=YOUR_KEY</code></p>` +
      `<p>Optional query params:</p>` +
      `<ul>` +
      `<li><code>since</code> (ISO timestamp) — filters by <code>article.published_at</code></li>` +
      `<li><code>limit</code> (max 50)</li>` +
      `</ul>` +
      `<p>Example:</p>` +
      `<pre>${endpoint}?key=${apiKey}&amp;since=2026-03-20T00:00:00Z&amp;limit=50</pre>` +
      `<p>Please keep this key secret.</p>`
  })

  eprint(`[approve-api-request] done. api_key=${apiKey}`)
}

main().catch((err) => {
  eprint('[approve-api-request] ERROR:', err)
  process.exit(1)
})
