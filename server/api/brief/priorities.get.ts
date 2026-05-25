import { serverSupabaseServiceRole } from '#supabase/server'

type PrioritySeverity = 'HIGH' | 'MEDIUM' | 'LOW'

function normalizeSeverity(input: unknown): PrioritySeverity {
	const raw = typeof input === 'string' ? input.trim().toUpperCase() : ''
	if (raw === 'HIGH' || raw === 'MEDIUM' || raw === 'LOW') return raw
	// Back-compat with older focus severity values.
	if (raw === 'CRITICAL') return 'HIGH'
	if (raw === 'HIGH') return 'HIGH'
	if (raw === 'MEDIUM') return 'MEDIUM'
	return 'LOW'
}

function formatAgo(input: unknown): string {
	const raw = typeof input === 'string' ? input.trim() : ''
	if (!raw) return ''
	const d = new Date(raw)
	if (!Number.isFinite(d.getTime())) return ''

	const deltaMs = Math.max(0, Date.now() - d.getTime())
	const minutes = Math.floor(deltaMs / 60_000)
	if (minutes < 60) return `${Math.max(1, minutes)} min ago`

	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${Math.max(1, hours)}h ago`

	const days = Math.floor(hours / 24)
	if (days < 7) return `${Math.max(1, days)}d ago`

	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(d)
}

export default defineEventHandler(async (event) => {
	try {
		const supabase = serverSupabaseServiceRole(event)

		const [{ count: totalCount }, { data, error }] = await Promise.all([
			supabase
				.from('focus_items')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'active'),
			supabase
			.from('focus_items')
			.select('title,slug,severity,status,updated_at')
			.eq('status', 'active')
			.order('severity', { ascending: false })
			.order('updated_at', { ascending: false })
			.limit(3)
		])

		if (error) throw error
		const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
		const items = rows
			.map((row, idx) => {
				const title = typeof row.title === 'string' ? row.title.trim() : ''
				const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
				const ago = formatAgo(row.updated_at)
				return {
					rank: idx + 1,
					title,
					slug,
					severity: normalizeSeverity(row.severity),
					ago
				}
			})
			.filter((i) => i.title && i.slug)
		return { items, totalCount: typeof totalCount === 'number' ? totalCount : 0 }
	} catch (err: unknown) {
		const e = err as { message?: string } | null
		console.error('[brief/priorities.get] error:', e?.message || err)
		return { items: [], totalCount: 0 }
	}
})
