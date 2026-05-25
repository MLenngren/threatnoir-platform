import { serverSupabaseServiceRole } from '#supabase/server'

type LandingEpisodeTone = 'people' | 'lock' | 'skull'

type LandingEpisode = {
	title: string
	description: string
	slug: string
	durationLabel: string
	tone: LandingEpisodeTone
	thumbnailUrl: string | null
}

type VideoBriefingRow = Record<string, unknown>

function durationLabel(seconds: unknown): string {
	const s = typeof seconds === 'number' ? seconds : Number(seconds)
	if (!Number.isFinite(s) || s <= 0) return '0:00'
	const total = Math.floor(s)
	const mm = Math.floor(total / 60)
	const ss = (total % 60).toString().padStart(2, '0')
	return `${mm}:${ss}`
}

function toneForIndex(i: number): LandingEpisodeTone {
	if (i === 1) return 'lock'
	if (i === 2) return 'skull'
	return 'people'
}

export default defineEventHandler(async (event) => {
	try {
		const supabase = serverSupabaseServiceRole(event)
		const { data, error } = await supabase
			.from('video_briefings')
				.select('title,slug,summary,duration_seconds,date,thumbnail_url,article_ids')
			.order('date', { ascending: false })
			.limit(3)

		if (error) throw error
		const rows = Array.isArray(data) ? (data as VideoBriefingRow[]) : []

			const fallbackIds: string[] = []
			for (const row of rows) {
				const tu = typeof row.thumbnail_url === 'string' ? row.thumbnail_url.trim() : ''
				const aIds = Array.isArray(row.article_ids) ? row.article_ids : []
				if (!tu && aIds.length > 0) {
					fallbackIds.push(String(aIds[0]))
				}
			}

			const fallbackImages: Record<string, string> = {}
			if (fallbackIds.length > 0) {
				const { data: artRows } = await supabase
					.from('articles')
					.select('id,image_url')
					.in('id', fallbackIds)
				for (const r of (artRows || []) as Array<Record<string, unknown>>) {
					const id = typeof r.id === 'string' ? r.id : ''
					const img = typeof r.image_url === 'string' ? r.image_url.trim() : ''
					if (id && img) fallbackImages[id] = img
				}
			}

		const items: LandingEpisode[] = rows.map((row, idx) => {
			const title = typeof row.title === 'string' ? row.title.trim() : ''
			const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
			const description = typeof row.summary === 'string' ? row.summary.trim() : ''
				const tu = typeof row.thumbnail_url === 'string' ? row.thumbnail_url.trim() : ''
				const aIds = Array.isArray(row.article_ids) ? row.article_ids : []
				const fallback = aIds.length > 0 ? fallbackImages[String(aIds[0])] || '' : ''
				const thumbnailUrl = tu || fallback || null
			return {
				title,
				slug,
				description,
					durationLabel: durationLabel(row.duration_seconds),
					tone: toneForIndex(idx),
					thumbnailUrl
				}
		}).filter((i) => i.title && i.slug)

		return { items }
	} catch (err: unknown) {
		const e = err as { message?: string } | null
		console.error('[landing/red-vs-blue.get] error:', e?.message || err)
		return { items: [] }
	}
})
