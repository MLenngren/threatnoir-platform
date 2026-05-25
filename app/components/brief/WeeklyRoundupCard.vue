<template>
	<article
		v-if="weekly"
		class="card"
		:style="{
			padding: '18px',
			display: 'flex',
			alignItems: 'center',
			gap: '16px'
		}"
	>
		<!-- small calendar tile -->
		<div
			:style="{
				width: '44px',
				height: '44px',
				borderRadius: '8px',
				flexShrink: '0',
				background: 'rgba(46,230,200,0.10)',
				border: '1px solid rgba(46,230,200,0.30)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center'
			}"
		>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-tn-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="5" width="18" height="16" rx="2" />
				<path d="M3 9h18" />
				<path d="M8 3v4M16 3v4" />
			</svg>
		</div>

		<div :style="{ flex: '1', minWidth: 0 }">
			<div :style="{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }">Weekly Threat Roundup</div>
			<div class="text-tn-ink-dim" :style="{ fontSize: '12px', lineHeight: '1.45' }">The full week in one comprehensive read.</div>
			<div class="text-tn-ink-mute" :style="{ fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '4px' }">
				{{ dateRangeLabel }}
			</div>
			<NuxtLink
				:to="`/weekly/${weekly.slug}`"
				:style="{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '6px',
					fontSize: '12.5px',
					color: 'var(--color-tn-accent)',
					marginTop: '6px',
					textDecoration: 'none'
				}"
			>
				Read latest roundup <span aria-hidden="true">→</span>
			</NuxtLink>
		</div>

		<!-- decorative disk -->
		<div
			:style="{
				width: '84px',
				height: '84px',
				borderRadius: '8px',
				flexShrink: '0',
				position: 'relative',
				overflow: 'hidden',
				background:
					'radial-gradient(circle at 35% 35%, rgba(46,230,200,0.18) 0%, rgba(7,19,26,0.6) 60%, #050B11 100%)',
				border: '1px solid var(--color-tn-line-deep)'
			}"
		>
			<svg viewBox="0 0 84 84" :style="{ position: 'absolute', inset: 0, width: '100%', height: '100%' }">
				<circle cx="42" cy="42" r="30" fill="none" stroke="rgba(46,230,200,0.18)" stroke-width="0.8" />
				<circle cx="42" cy="42" r="22" fill="none" stroke="rgba(46,230,200,0.28)" stroke-width="0.8" />
				<circle cx="42" cy="42" r="14" fill="none" stroke="rgba(46,230,200,0.45)" stroke-width="1" />
			</svg>
			<div
				:style="{
					position: 'absolute',
					left: '50%',
					top: '50%',
					transform: 'translate(-50%,-50%)',
					width: '22px',
					height: '22px',
					borderRadius: '50%',
					background: 'var(--color-tn-accent)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}"
			>
				<svg width="9" height="9" viewBox="0 0 24 24" fill="#07131A"><path d="M8 5v14l11-7z" /></svg>
			</div>
		</div>
	</article>
</template>

<script setup lang="ts">
type WeeklyRoundup = {
	slug: string
	weekLabel: string
	tagline: string | null
	dateFrom: string
	dateTo: string
}

const { data } = await useFetch<WeeklyRoundup | null>('/api/brief/weekly', {
	key: 'brief-weekly-card',
	server: true
})

const weekly = computed(() => data.value)

function formatDateRange(dateFrom: string, dateTo: string): string {
	try {
		const from = new Date(dateFrom)
		const to = new Date(dateTo)
		if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return ''

		const sameYear = from.getUTCFullYear() === to.getUTCFullYear()
		if (sameYear) {
			const fmtFrom = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
			const fmtTo = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
			return `${fmtFrom.format(from)} – ${fmtTo.format(to)}`
		}

		const fmtFull = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
		return `${fmtFull.format(from)} – ${fmtFull.format(to)}`
	} catch {
		return ''
	}
}

const dateRangeLabel = computed(() => {
	const w = weekly.value
	if (!w) return ''
	return formatDateRange(w.dateFrom, w.dateTo)
})
</script>
