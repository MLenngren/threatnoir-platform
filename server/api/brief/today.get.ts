import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'

type Brief = {
	edition: 'Morning Brief' | 'Evening Brief'
	date: string
	time: string
	title: string
	bullets: string[]
	severity: 'HIGH' | 'MEDIUM'
	readMinutes: number
	iocCount: number
	podcastDuration: string
	updatedAt: string
	updatedAgo: string
	reviewUrl: string
	podcastUrl: string
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

function extractDialogueLines(dialogue: unknown): Array<{ text: string }> {
	if (!dialogue || typeof dialogue !== 'object') return []
	const rec = dialogue as Record<string, unknown>
	const lines = Array.isArray(rec.lines) ? rec.lines : []
	const out: Array<{ text: string }> = []
	for (const line of lines) {
		const lineRec = line && typeof line === 'object' ? (line as Record<string, unknown>) : {}
		const text = typeof lineRec.text === 'string' ? lineRec.text : ''
		if (text) out.push({ text })
	}
	return out
}

function extractBullets(dialogue: unknown): string[] {
	const lines = extractDialogueLines(dialogue)
	const out: string[] = []
	for (const line of lines) {
		if (out.length >= 3) break
		const cleaned = clipText(line.text, 90)
		if (cleaned) out.push(cleaned)
	}
	return out
}

function countWords(input: string): number {
	const s = input.trim().replace(/\s+/g, ' ')
	if (!s) return 0
	return s.split(' ').filter(Boolean).length
}

function computeReadMinutes(dialogue: unknown): number {
	try {
		const lines = extractDialogueLines(dialogue)
		let words = 0
		for (const l of lines) words += countWords(l.text)
		const minutes = Math.ceil(words / 200)
		const clamped = Math.min(30, Math.max(1, minutes))
		return Number.isFinite(clamped) ? clamped : 4
	} catch {
		return 4
	}
}

function formatDuration(seconds: unknown): string {
	const s = typeof seconds === 'number' ? seconds : Number(seconds)
	if (!Number.isFinite(s) || s <= 0) return '0:00'
	const total = Math.floor(s)
	const mm = Math.floor(total / 60)
	const ss = (total % 60).toString().padStart(2, '0')
	return `${mm}:${ss}`
}

function formatAgo(input: unknown): { updatedAt: string; updatedAgo: string } | null {
	const raw = typeof input === 'string' ? input.trim() : ''
	if (!raw) return null
	const d = new Date(raw)
	if (!Number.isFinite(d.getTime())) return null

	const now = Date.now()
	const deltaMs = Math.max(0, now - d.getTime())
	const minutes = Math.floor(deltaMs / 60_000)

	if (minutes < 60) {
		const m = Math.max(1, minutes)
		return { updatedAt: raw, updatedAgo: `${m} min ago` }
	}

	const hours = Math.floor(minutes / 60)
	if (hours < 24) {
		const h = Math.max(1, hours)
		return { updatedAt: raw, updatedAgo: `${h}h ago` }
	}

	const days = Math.floor(hours / 24)
	if (days < 7) {
		const dd = Math.max(1, days)
		return { updatedAt: raw, updatedAgo: `${dd}d ago` }
	}

	const dateLabel = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(d)
	return { updatedAt: raw, updatedAgo: dateLabel }
}

function formatLastUpdatedTime(input: unknown): string | null {
	const raw = typeof input === 'string' ? input.trim() : ''
	if (!raw) return null
	const d = new Date(raw)
	if (!Number.isFinite(d.getTime())) return null
	return new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'Europe/Stockholm'
	}).format(d)
}

async function buildBrief(event: H3Event, opts: {
	editionKey: 'morning' | 'afternoon'
	kind: 'morning' | 'evening'
}): Promise<Brief | null> {
	const supabase = serverSupabaseServiceRole(event)

	try {
		const { data: row, error } = await supabase
			.from('podcast_episodes')
			.select('date,edition,title,dialogue,duration_seconds,article_ids,created_at')
			.eq('edition', opts.editionKey)
			.order('date', { ascending: false })
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle()

		if (error) throw error
		const rec = (row ?? null) as PodcastEpisodeRow | null
		if (!rec) return null

		const dateIso = typeof rec.date === 'string' ? rec.date.trim() : ''
		const dateLong = formatLongDate(dateIso)
		const titleFallback = typeof rec.title === 'string' ? rec.title.trim() : ''
		const dialogueTitle = extractDialogueTitle(rec.dialogue)
		const title = dialogueTitle || titleFallback
		if (!dateLong || !title) return null

		const articleIds = Array.isArray(rec.article_ids) ? rec.article_ids.map(String).filter(Boolean) : []

		let iocCount = 0
		if (articleIds.length > 0) {
			try {
				const countRes = await supabase
					.from('article_iocs')
					.select('id', { count: 'exact', head: true })
					.in('article_id', articleIds)
				if (!countRes.error && typeof countRes.count === 'number') {
					iocCount = countRes.count
				}
			} catch {
				iocCount = 0
			}
		}

		const isMorning = opts.kind === 'morning'
			const ago = formatAgo(rec.created_at)
		return {
			edition: isMorning ? 'Morning Brief' : 'Evening Brief',
			date: dateLong,
			time: isMorning ? '07:30' : '18:00',
			title,
			bullets: extractBullets(rec.dialogue),
			severity: isMorning ? 'HIGH' : 'MEDIUM',
			readMinutes: computeReadMinutes(rec.dialogue),
			iocCount,
			podcastDuration: formatDuration(rec.duration_seconds),
				updatedAt: ago?.updatedAt ?? '',
				updatedAgo: ago?.updatedAgo ?? '',
			reviewUrl: dateIso ? `/review/${dateIso}/${opts.editionKey}` : '/review',
			podcastUrl: dateIso ? `/review/${dateIso}/${opts.editionKey}` : '/review'
		}
	} catch (err: unknown) {
		const e = err as { message?: string } | null
		console.error('[brief/today.get] edition error:', opts.editionKey, e?.message || err)
		return null
	}
}

export default defineEventHandler(async (event) => {
	try {
		const [morning, evening] = await Promise.all([
			buildBrief(event, { editionKey: 'morning', kind: 'morning' }),
			buildBrief(event, { editionKey: 'afternoon', kind: 'evening' })
		])
		const candidates = [morning?.updatedAt, evening?.updatedAt].filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
		let latestIso: string | null = null
		for (const iso of candidates) {
			const d = new Date(iso)
			if (!Number.isFinite(d.getTime())) continue
			if (!latestIso) {
				latestIso = iso
				continue
			}
			const prev = new Date(latestIso)
			if (d.getTime() > prev.getTime()) latestIso = iso
		}
		const lastUpdatedTime = latestIso ? formatLastUpdatedTime(latestIso) : null
		return { morning, evening, lastUpdatedTime }
	} catch (err: unknown) {
		const e = err as { message?: string } | null
		console.error('[brief/today.get] error:', e?.message || err)
		return { morning: null, evening: null, lastUpdatedTime: null }
	}
})
