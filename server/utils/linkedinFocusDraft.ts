import type { SupabaseClient } from '@supabase/supabase-js'

import { emailRecipients } from './emailConfig'
import { sendWelcomeEmail } from './resend'
import { getSiteConfig } from './siteConfig'
import { draftLinkedinFocusDirect } from './anthropic'

type FocusItemInput = {
  id: string
  title: string
  summary: string
  severity: string
  cve_ids?: string[]
  affected_products?: string[]
  action_required?: string
}

const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escapeHtml(input: string): string {
  return (input || '').replace(/[&<>"']/g, (ch) => HTML_ESC[ch] || ch)
}

export async function generateAndEmailFocusDraft(
  supabase: SupabaseClient,
  focusItem: FocusItemInput
): Promise<void> {
  try {
			const site = getSiteConfig()

    const { data: existing, error: existingErr } = await supabase
      .from('focus_items')
      .select('linkedin_drafted_at')
      .eq('id', focusItem.id)
      .maybeSingle()

    if (existingErr) {
      console.error('[linkedinFocusDraft] DB error (check drafted):', existingErr.message)
      return
    }

		if (!existing) {
			console.error('[linkedinFocusDraft] Focus item not found:', focusItem.id)
			return
		}

    if ((existing as Record<string, unknown> | null)?.linkedin_drafted_at) return

			const gatewayUrl = process.env.AI_GATEWAY_URL?.trim()
			const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
			if (!gatewayUrl && !apiKey) {
				console.error('[linkedinFocusDraft] ANTHROPIC_API_KEY is not configured (and AI_GATEWAY_URL is unset)')
				return
			}

			const focus = {
				id: focusItem.id,
				title: focusItem.title,
				summary: focusItem.summary,
				severity: focusItem.severity,
				cve_ids: focusItem.cve_ids,
				affected_products: focusItem.affected_products,
				action_required: focusItem.action_required
			}

			let postText = ''
			if (gatewayUrl) {
				const token = process.env.AI_GATEWAY_INTERNAL_TOKEN
				if (!token || !token.trim()) {
					throw new Error('AI_GATEWAY_INTERNAL_TOKEN must be set when AI_GATEWAY_URL is set')
				}

				const base = gatewayUrl.replace(/\/+$/, '')
				const url = `${base}/draft-linkedin-focus`
				const timeoutMs = Number(process.env.AI_GATEWAY_TIMEOUT_MS) || 60_000
				let res: Awaited<ReturnType<typeof fetch>>
				try {
					res = await fetch(url, {
						method: 'POST',
						headers: {
							'content-type': 'application/json',
							'x-gateway-token': token
						},
						body: JSON.stringify({ siteName: site.name, siteUrl: site.url, focus }),
						signal: AbortSignal.timeout(timeoutMs)
					})
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
					throw new Error(
						`[ai-gateway] ${isTimeout ? `timeout after ${timeoutMs}ms` : 'network error'} calling ${url}: ${msg}`
					)
				}

				if (!res.ok) {
					const body = await res.text().catch(() => '')
					throw new Error(
						`[ai-gateway] ${res.status} calling ${url}: ` + (body ? body.slice(0, 800) : res.statusText)
					)
				}

				const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
				postText = typeof data?.text === 'string' ? data.text.trim() : ''
			} else {
				postText = (await draftLinkedinFocusDirect({ siteName: site.name, siteUrl: site.url, focus })).trim()
			}

    if (!postText) {
			  console.error('[linkedinFocusDraft] AI response was empty')
      return
    }

    const subject = `🔴 Focus draft: ${focusItem.title}`
    const bodyText = `Copy and paste to LinkedIn.\n\n---\n\n${postText}\n`

    const html =
      '<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">' +
      `<p><strong>${escapeHtml(subject)}</strong></p>` +
      '<p>Copy and paste the post text below into LinkedIn.</p>' +
      '<hr style="border:none;border-top:1px solid #e5e7eb;"/>' +
      `<pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.6;">${escapeHtml(postText)}</pre>` +
      '</div>'

    await sendWelcomeEmail({
	      to: emailRecipients.linkedinDraft(),
      subject,
      html,
      text: bodyText
    })

    const nowIso = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('focus_items')
      .update({ linkedin_drafted_at: nowIso })
      .eq('id', focusItem.id)

    if (updateErr) {
      console.error('[linkedinFocusDraft] DB error (set drafted):', updateErr.message)
    }
  } catch (err) {
    console.error('[linkedinFocusDraft] failed:', err)
  }
}

