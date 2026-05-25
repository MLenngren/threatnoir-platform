import { serverSupabaseServiceRole } from '#supabase/server'

type LandingBrief = {
	edition: string
	date: string
	time: string
	title: string
	bullets: string[]
	severity: string
	link: string
}

type PodcastEpisodeRow = Record<string, unknown>

function clipText(input: string, maxLen: number) {
	const s = input.trim().replace(/\s+/g, ' ')
	if (s.length <= maxLen) return s
	if (maxLen <= 1) return '…'
	return `${s.slice(0, maxLen - 1).trimEnd()}…`
}

function formatLongDate(dateStr: unknown): string | null {
	const raw = typeof dateStr === 'string' ? dateStr.trim() : ''
	if (!raw) return null
	// Ensure stable timezone formatting.
	const d = new Date(`${raw}T00:00:00Z`)
	if (Number.isNaN(d.getTime())) return null
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(d)
}

function extractDialogueTitle(dialogue: unknown): string | null {
	if (!dialogue || typeof dialogue !== 'object') return null
	const rec = dialogue as Record<string, unknown>
	const headline = typeof rec.headline === 'string' ? rec.headline.trim() : ''
	return headline || null
}

function extractBullets(dialogue: unknown): string[] {
	if (!dialogue || typeof dialogue !== 'object') return []
	const rec = dialogue as Record<string, unknown>
	const lines = Array.isArray(rec.lines) ? rec.lines : []

	const out: string[] = []
	for (const line of lines) {
		if (out.length >= 3) break
		const lineRec = line && typeof line === 'object' ? (line as Record<string, unknown>) : {}
		const text = typeof lineRec.text === 'string' ? lineRec.text : ''
		const cleaned = clipText(text, 90)
		if (cleaned) out.push(cleaned)
	}
	return out
}

function normalizeBrief(row: PodcastEpisodeRow | null, kind: 'morning' | 'evening'): LandingBrief | null {
	if (!row) return null
	// `podcast_episodes.date` is stored as an ISO date string (YYYY-MM-DD).
	const dateIso = typeof row.date === 'string' ? row.date.trim() : ''
	const edition = typeof row.edition === 'string' ? row.edition.trim() : ''
	const date = formatLongDate(row.date)
	const titleFallback = typeof row.title === 'string' ? row.title.trim() : ''
	const dialogueTitle = extractDialogueTitle(row.dialogue)

	const title = dialogueTitle || titleFallback
	if (!date || !title) return null

	const isMorning = kind === 'morning'
	const link = (dateIso && edition) ? `/review/${dateIso}/${edition}` : '/podcast'
	return {
		edition: isMorning ? 'Morning Brief' : 'Evening Brief',
		date,
		time: isMorning ? '07:30' : '18:00',
		title,
		bullets: extractBullets(row.dialogue),
		severity: isMorning ? 'HIGH' : 'MEDIUM',
		link
	}
}

export default defineEventHandler(async (event) => {
	try {
		const supabase = serverSupabaseServiceRole(event)

		const [morningRes, eveningRes] = await Promise.all([
			supabase
				.from('podcast_episodes')
				.select('date,edition,title,dialogue')
				.eq('edition', 'morning')
				.order('date', { ascending: false })
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle(),
			supabase
				.from('podcast_episodes')
				.select('date,edition,title,dialogue')
				.eq('edition', 'afternoon')
				.order('date', { ascending: false })
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle()
		])

		if (morningRes.error) throw morningRes.error
		if (eveningRes.error) throw eveningRes.error

		const morningRow = (morningRes.data ?? null) as PodcastEpisodeRow | null
		const eveningRow = (eveningRes.data ?? null) as PodcastEpisodeRow | null

		return {
			morning: normalizeBrief(morningRow, 'morning'),
			evening: normalizeBrief(eveningRow, 'evening')
		}
	} catch (err: unknown) {
		const e = err as { message?: string } | null
		console.error('[landing/latest-briefs.get] error:', e?.message || err)
		return { morning: null, evening: null }
	}
})
