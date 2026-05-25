<template>
	<section :style="{ padding: '28px 0' }">
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" :style="{ gap: '16px' }">
			<article class="card" :style="cardStyle">
				<div :style="iconWrapStyle" aria-hidden="true">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
						<path d="M8 9h8" />
						<path d="M8 15h6" />
						<path d="M10 2h4" />
						<path d="M12 4v2" />
						<rect x="5" y="6" width="14" height="16" rx="2" />
					</svg>
				</div>
				<div>
					<div :style="titleStyle">IOCs</div>
					<p class="text-tn-ink-dim" :style="descStyle">Search indicators from today's briefs.</p>
				</div>
				<NuxtLink to="/iocs" :style="ctaStyle">View IOCs <span aria-hidden="true">→</span></NuxtLink>
			</article>

			<article class="card" :style="cardStyle">
				<div :style="iconWrapStyle" aria-hidden="true">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="4" width="18" height="18" rx="2" />
						<path d="M16 2v4M8 2v4" />
						<path d="M3 10h18" />
					</svg>
				</div>
				<div>
					<div :style="titleStyle">Events</div>
					<p class="text-tn-ink-dim" :style="descStyle">Upcoming webinars and industry events.</p>
				</div>
				<NuxtLink to="/events" :style="ctaStyle">View events <span aria-hidden="true">→</span></NuxtLink>
			</article>

			<article class="card" :style="cardStyle">
				<div :style="iconWrapStyle" aria-hidden="true">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
						<path d="M6 4h12" />
						<path d="M6 8h12" />
						<path d="M6 12h8" />
						<path d="M6 20h12" />
						<path d="M6 16h12" />
					</svg>
				</div>
				<div>
					<div :style="titleStyle">Feed</div>
					<p class="text-tn-ink-dim" :style="descStyle">All high-impact articles in one place.</p>
				</div>
				<NuxtLink to="/feed" :style="ctaStyle">Browse feed <span aria-hidden="true">→</span></NuxtLink>
			</article>

			<article class="card" :style="cardStyle">
				<div :style="iconWrapStyle" aria-hidden="true">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 3v18" />
						<path d="M7 7h10" />
						<path d="M9 7l-4 8a2 2 0 0 0 2 3h2" />
						<path d="M15 7l4 8a2 2 0 0 1-2 3h-2" />
						<path d="M5 21h14" />
					</svg>
				</div>
				<div>
					<div :style="titleStyle">Legal</div>
					<p class="text-tn-ink-dim" :style="descStyle">Terms, privacy, and editorial policy.</p>
				</div>
				<NuxtLink to="/legal" :style="ctaStyle">View legal <span aria-hidden="true">→</span></NuxtLink>
			</article>
		</div>
	</section>
</template>

<script setup lang="ts">
const cardStyle = {
	padding: '20px',
	display: 'flex',
	flexDirection: 'column',
	gap: '12px'
} as const

const iconWrapStyle = {
	color: 'var(--color-tn-accent)'
} as const

const titleStyle = {
	fontSize: '14px',
	fontWeight: '700'
} as const

const descStyle = {
	margin: '4px 0 0',
	fontSize: '12.5px',
	lineHeight: '1.45'
} as const

const ctaStyle = {
	marginTop: 'auto',
	fontSize: '12.5px',
	color: 'var(--color-tn-accent)',
	display: 'inline-flex',
	alignItems: 'center',
	gap: '6px',
	textDecoration: 'none'
} as const
</script>
