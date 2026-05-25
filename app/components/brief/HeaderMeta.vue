<template>
	<div
		:style="{
			display: 'flex',
			alignItems: 'center',
			gap: '18px',
			marginTop: '14px',
			fontSize: '12.5px',
			color: 'var(--color-tn-ink-mute)',
			fontFamily: 'var(--font-mono)'
		}"
	>
		<span :style="{ display: 'inline-flex', alignItems: 'center', gap: '8px' }">
			<span class="tn-pulse-dot" :style="{ background: 'var(--color-tn-accent)' }" />
			All times in your local time (CET)
		</span>
		<span :style="{ display: 'inline-flex', alignItems: 'center', gap: '6px' }">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="9" />
				<path d="M12 7v5l3 2" />
			</svg>
			Last updated: {{ lastUpdatedLabel }}
		</span>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{ lastUpdatedTime?: string | null }>()

const lastUpdatedLabel = computed(() => {
	const raw = (props.lastUpdatedTime ?? '').trim()
	return raw || '—'
})
</script>

<style scoped>
.tn-pulse-dot {
	width: 6px;
	height: 6px;
	border-radius: 999px;
	animation: tn-pulse 1.4s ease-in-out infinite;
}

@keyframes tn-pulse {
	0%,
	100% {
		opacity: 0.55;
		transform: scale(0.9);
	}
	50% {
		opacity: 1;
		transform: scale(1.15);
	}
}

@media (prefers-reduced-motion: reduce) {
	.tn-pulse-dot {
		animation: none;
		opacity: 0.9;
	}
}
</style>
