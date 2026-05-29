import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

import { logAiCall } from './aiUsage'
import { sendWelcomeEmail } from './resend'
import { getSiteConfig } from './siteConfig'

const LINKEDIN_VOICE_PROMPT =
  "When drafting LinkedIn posts for the weekly ThreatNoir roundup, match Marcus's actual posting style:\n\n" +
  "**Why:** Marcus posted the W14 roundup manually and the voice was much better than the AI-drafted numbered list. His style got engagement because it felt like a real person sharing, not a news bulletin.\n\n" +
  "**How to apply:**\n\nStructure:\n" +
  "- Open with personal commentary, not a cold hook. \"I read that...\", \"Last week was...\", a question or observation\n" +
  "- Flow as conversational paragraphs, NOT numbered lists\n" +
  "- Each story gets its own paragraph with 1-2 sentences\n" +
  "- Add parenthetical asides that show opinion: \"(it does feel like Fortinet gets hit a lot?)\", \"(rougher than usual?)\"\n" +
  "- End with the punchy tagline from the card\n" +
  "- Link at the bottom, standalone, not inline\n" +
  "- Hashtags at the very end: #cybersecurity + 1-2 topic-specific\n\nTone:\n" +
  "- Practitioner sharing with peers, not analyst briefing executives\n" +
  "- \"I read that...\" not \"This week brought...\"\n" +
  "- Personal takes: \"not sure how long you would survive\" not \"organizations face significant risk\"\n" +
  "- Slight provocations as questions, not statements\n" +
  "- No bold, no bullet points, no numbered lists\n" +
  "- No emoji\n\nReference post (W14):\n" +
  "\"I read that last week was rough (rougher than usual?), if you are a business (big or small) good IT hygiene can be optional if you accept the risk, but not sure how long you would survive...\""

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

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
    if (!apiKey) {
      console.error('[linkedinFocusDraft] ANTHROPIC_API_KEY is not configured')
      return
    }

    const userPrompt =
      `Write an urgent LinkedIn post about this critical security issue. ` +
      `Title: ${focusItem.title}. ` +
      `Summary: ${focusItem.summary}. ` +
      `CVEs: ${(focusItem.cve_ids && focusItem.cve_ids.length) ? focusItem.cve_ids.join(', ') : '(none)'}. ` +
      `Affected: ${(focusItem.affected_products && focusItem.affected_products.length) ? focusItem.affected_products.join(', ') : '(unknown)'}. ` +
      `Action: ${(focusItem.action_required || '').trim() || '(none provided)'}. ` +
      `Keep it under 150 words. Direct, first-person, practitioner sharing an alert. ` +
	      `End with link to ${getSiteConfig().url}/focus. No emoji, no bold, no lists.`

    const client = new Anthropic({ apiKey })
	    const model = 'claude-haiku-4-5-20251001'
	    const startedAt = Date.now()
	    const resp = await client.messages.create({
	      model,
      max_tokens: 500,
      temperature: 0.7,
      system: LINKEDIN_VOICE_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    })

	    await logAiCall({
	      pipeline: 'linkedin_draft_focus',
	      model,
	      response: resp,
	      durationMs: Date.now() - startedAt,
	      metadata: {
	        focus_item_id: focusItem.id,
	        severity: focusItem.severity
	      }
	    })

    const postText = (resp.content || [])
      .map((c) => (c.type === 'text' ? (c.text || '') : ''))
      .filter(Boolean)
      .join('\n')
      .trim()

    if (!postText) {
      console.error('[linkedinFocusDraft] Anthropic response was empty')
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
      to: process.env.ADMIN_EMAIL || 'admin@example.com',
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

