import { serverSupabaseServiceRole } from '#supabase/server'

type WeeklyBriefResponse = {
	weekLabel: string
	slug: string
	bullets: string[]
}

type WeeklyRow = Record<string, unknown>

const EMOJI_PREFIX_RE = /^[\p{Emoji}\s]+/u

function formatMonthDay(dateStr: unknown): { label: string; year: number } | null {
	const raw = typeof dateStr === 'string' ? dateStr.trim() : ''
	if (!raw) return null
	const d = new Date(`${raw}T00:00:00Z`)
	if (Number.isNaN(d.getTime())) return null
	const label = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	}).format(d)
	return { label, year: d.getUTCFullYear() }
}

function weekLabel(from: unknown, to: unknown): string | null {
	const f = formatMonthDay(from)
	const t = formatMonthDay(to)
	if (!f || !t) return null
	return `Week of ${f.label} – ${t.label}, ${t.year}`
}

function bulletsFromTldr(tldr: unknown): string[] {
	const raw = typeof tldr === 'string' ? tldr : ''
	if (!raw.trim()) return []
	return raw
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => l.replace(EMOJI_PREFIX_RE, '').trim())
		.filter(Boolean)
		.slice(0, 4)
}

export default defineEventHandler(async (event) => {
	try {
		const supabase = serverSupabaseServiceRole(event)
		const { data, error } = await supabase
			.from('weekly_roundups')
			.select('slug,date_from,date_to,tldr,published_at')
			.eq('status', 'published')
			.order('published_at', { ascending: false, nullsFirst: false })
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle()

		if (error) throw error
		if (!data) return null
		const row = data as WeeklyRow

		const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
		const label = weekLabel(row.date_from, row.date_to)
		if (!slug || !label) return null

		const bullets = bulletsFromTldr(row.tldr)
		const out: WeeklyBriefResponse = { weekLabel: label, slug, bullets }
		return out
	} catch (err: unknown) {
		const e = err as { message?: string } | null
		console.error('[landing/weekly-brief.get] error:', e?.message || err)
		return null
	}
})
