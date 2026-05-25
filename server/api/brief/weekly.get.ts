import { serverSupabaseServiceRole } from '#supabase/server'

type WeeklyRoundupResponse = {
	slug: string
	weekLabel: string
	tagline: string | null
	dateFrom: string
	dateTo: string
} | null

type WeeklyRoundupRow = Record<string, unknown>

export default defineEventHandler(async (event): Promise<WeeklyRoundupResponse> => {
	try {
		const supabase = serverSupabaseServiceRole(event)
		const { data: row, error } = await supabase
			.from('weekly_roundups')
			.select('week_label,slug,date_from,date_to,tagline,status')
			.eq('status', 'published')
			.order('date_to', { ascending: false })
			.limit(1)
			.maybeSingle()

		if (error) throw error
		const rec = (row ?? null) as WeeklyRoundupRow | null
		if (!rec) return null

		const slug = typeof rec.slug === 'string' ? rec.slug.trim() : ''
		const weekLabel = typeof rec.week_label === 'string' ? rec.week_label.trim() : ''
		const tagline = typeof rec.tagline === 'string' ? rec.tagline.trim() : null
		const dateFrom = typeof rec.date_from === 'string' ? rec.date_from.trim() : ''
		const dateTo = typeof rec.date_to === 'string' ? rec.date_to.trim() : ''

		if (!slug || !weekLabel || !dateFrom || !dateTo) return null
		return { slug, weekLabel, tagline, dateFrom, dateTo }
	} catch (err: unknown) {
		const e = err as { message?: string } | null
		console.error('[brief/weekly.get] error:', e?.message || err)
		return null
	}
})
