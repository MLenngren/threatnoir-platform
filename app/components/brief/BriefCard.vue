<template>
	<article
		:style="{
			position: 'relative',
			padding: '26px',
			borderRadius: '10px',
			border: isPrimary ? `1px solid ${accent}` : '1px solid var(--color-tn-line-deep)',
			background: 'var(--color-tn-card-deep)',
			display: 'flex',
			flexDirection: 'column',
			gap: '18px',
			boxShadow: isPrimary ? `0 0 0 1px ${accent}40, 0 8px 32px ${glowShadow}` : 'none'
		}"
	>
		<!-- Top label row -->
		<div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
			<span
				:style="{
					fontSize: '11px',
					fontWeight: '700',
					letterSpacing: '0.14em',
					textTransform: 'uppercase',
					color: isPrimary ? accent : 'var(--color-tn-ink-mute)'
				}"
			>
				{{ isPrimary ? 'PRIMARY BRIEF' : 'LATER TODAY' }}
			</span>
			<div
				v-if="isPrimary"
				:style="{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '6px',
					padding: '5px 12px',
					borderRadius: '999px',
					background: accentSoft,
					border: `1px solid ${accent}`,
					color: accent,
					fontSize: '10.5px',
					fontWeight: '700',
					letterSpacing: '0.12em'
				}"
			>
				<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L14.5 9 L22 9.3 L16 14 L18 22 L12 17.5 L6 22 L8 14 L2 9.3 L9.5 9 Z" /></svg>
				START HERE
			</div>
		</div>

		<!-- Title row: icon tile + edition name -->
		<div :style="{ display: 'flex', alignItems: 'center', gap: '14px' }">
			<div
				:style="{
					width: '44px',
					height: '44px',
					borderRadius: '8px',
					background: accentSoft,
					border: `1px solid ${accent}40`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					flexShrink: '0'
				}"
			>
				<svg v-if="kind === 'morning'" width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="1.8" stroke-linecap="round">
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
				</svg>
				<svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="accent" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
				</svg>
			</div>
			<h2 :style="{ margin: 0, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.01em' }">
				{{ brief.edition }}
			</h2>
		</div>

		<!-- Meta row: date · time · LATEST · severity -->
		<div
			:style="{
				display: 'flex',
				alignItems: 'center',
				gap: '12px',
				flexWrap: 'wrap',
				fontFamily: 'var(--font-mono)',
				fontSize: '12.5px',
				color: 'var(--color-tn-ink-dim)'
			}"
		>
			<span>{{ brief.date }}</span>
			<span :style="{ opacity: '0.5' }">•</span>
			<span>{{ brief.time }}</span>
			<span
				v-if="isPrimary"
				:style="{
					padding: '3px 10px',
					borderRadius: '4px',
					background: accentSoft,
					color: accent,
					fontSize: '10.5px',
					fontWeight: '700',
					letterSpacing: '0.08em',
					fontFamily: 'var(--font-label)'
				}"
			>
				LATEST
			</span>
			<span
				:style="{
					marginLeft: 'auto',
					flexShrink: '0',
					padding: '3px 10px',
					borderRadius: '4px',
					fontSize: '10.5px',
					fontWeight: '700',
					letterSpacing: '0.08em',
					background: severityBg,
					color: severityText,
					fontFamily: 'var(--font-label)'
				}"
			>
				{{ brief.severity }}
			</span>
		</div>

		<!-- Headline -->
		<h3 :style="{ margin: 0, fontSize: '21px', lineHeight: '1.3', fontWeight: '700', letterSpacing: '-0.005em' }">
			{{ brief.title }}
		</h3>

		<!-- Bullets -->
		<ul :style="{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }">
			<li
				v-for="(b, i) in brief.bullets"
				:key="i"
				class="text-tn-ink-dim"
				:style="{ display: 'flex', gap: '10px', fontSize: '14px', lineHeight: '1.5' }"
			>
				<span :style="{ color: accent, marginTop: '1px' }">•</span>
				<span>{{ b }}</span>
			</li>
		</ul>

		<!-- read meta -->
		<div
			class="text-tn-ink-mute"
			:style="{ display: 'flex', alignItems: 'center', gap: '18px', fontSize: '12px', fontFamily: 'var(--font-mono)' }"
		>
			<span :style="{ display: 'inline-flex', alignItems: 'center', gap: '6px' }">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 7v5l3 2" />
				</svg>
				~{{ brief.readMinutes }} min read
			</span>
			<span :style="{ display: 'inline-flex', alignItems: 'center', gap: '6px' }">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
					<circle cx="9" cy="7" r="4" />
					<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
					<path d="M16 3.13a4 4 0 0 1 0 7.75" />
				</svg>
				{{ brief.iocCount }} IOCs
			</span>
		</div>

		<!-- CTA buttons -->
		<div :style="{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }">
			<NuxtLink
				:to="brief.reviewUrl"
				:style="{
					padding: '12px 16px',
					borderRadius: '6px',
					background: accent,
					border: `1px solid ${accent}`,
					color: '#07131A',
					fontSize: '14px',
					fontWeight: '700',
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '8px',
					textDecoration: 'none'
				}"
			>
				Read full brief <span aria-hidden="true">→</span>
			</NuxtLink>
			<NuxtLink
				:to="brief.podcastUrl"
				:style="{
					padding: '12px 16px',
					borderRadius: '6px',
					background: 'transparent',
					border: `1px solid ${accent}80`,
					color: accent,
					fontSize: '14px',
					fontWeight: '600',
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '8px',
					textDecoration: 'none'
				}"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 12a9 9 0 0 1 18 0v6a3 3 0 0 1-3 3h-1v-7h4" />
					<path d="M3 12v6a3 3 0 0 0 3 3h1v-7H3" />
				</svg>
				Listen ({{ brief.podcastDuration }})
			</NuxtLink>
		</div>

		<!-- Updated footer line (primary only) -->
		<div
			v-if="isPrimary"
			class="text-tn-ink-mute"
			:style="{
				marginTop: '4px',
				paddingTop: '14px',
				borderTop: '1px solid var(--color-tn-line-deep)',
				fontSize: '11.5px',
				fontFamily: 'var(--font-mono)',
				display: 'flex',
				alignItems: 'center',
				gap: '8px'
			}"
		>
			<span class="tn-updated-pulse" :style="{ background: accent }" />
			Updated {{ updatedLabel }}
		</div>
	</article>
</template>

<script setup lang="ts">
type Brief = {
	edition: 'Morning Brief' | 'Evening Brief'
	date: string
	time: string
	title: string
	bullets: string[]
	severity: 'HIGH' | 'MEDIUM' | 'LOW'
	readMinutes: number
	iocCount: number
	podcastDuration: string
	updatedAgo?: string
	reviewUrl: string
	podcastUrl: string
}

const props = defineProps<{ brief: Brief; kind: 'morning' | 'evening'; role: 'primary' | 'secondary' }>()

const isPrimary = computed(() => props.role === 'primary')

const accent = computed(() => (props.kind === 'morning' ? '#2EE6C8' : '#3FA9F5'))
const accentSoft = computed(() => (props.kind === 'morning' ? 'rgba(46,230,200,0.12)' : 'rgba(63,169,245,0.12)'))

const glowShadow = computed(() => (props.kind === 'morning' ? 'rgba(46,230,200,0.06)' : 'rgba(63,169,245,0.06)'))

const severityBg = computed(() => {
	if (props.brief.severity === 'HIGH') return 'rgba(255,77,77,0.18)'
	if (props.brief.severity === 'MEDIUM') return 'rgba(244,176,46,0.18)'
	return 'rgba(76,215,246,0.15)'
})

const severityText = computed(() => {
	if (props.brief.severity === 'HIGH') return '#FF6B6B'
	if (props.brief.severity === 'MEDIUM') return '#F4B02E'
	return '#4CD7F6'
})

const updatedLabel = computed(() => {
	const raw = (props.brief.updatedAgo ?? '').trim()
	return raw || '—'
})
</script>

<style scoped>
.tn-updated-pulse {
	width: 5px;
	height: 5px;
	border-radius: 999px;
	animation: tn-updated-pulse 1.3s ease-in-out infinite;
}

@keyframes tn-updated-pulse {
	0%,
	100% {
		opacity: 0.5;
		transform: scale(0.9);
	}
	50% {
		opacity: 1;
		transform: scale(1.15);
	}
}

@media (prefers-reduced-motion: reduce) {
	.tn-updated-pulse {
		animation: none;
		opacity: 0.9;
	}
}
</style>
