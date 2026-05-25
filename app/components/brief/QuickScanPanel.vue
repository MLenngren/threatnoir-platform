<template>
	<section :style="{ paddingBottom: '28px' }">
		<div class="card" :style="{ padding: '24px' }">
			<header
				:style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }"
			>
				<div>
					<div :style="{ display: 'flex', alignItems: 'center', gap: '8px' }">
						<svg width="14" height="14" viewBox="0 0 24 24" :fill="accent">
							<path d="M13 2 L3 14 h7 l-1 8 L21 10 h-7 z" />
						</svg>
						<span
							:style="{
								fontSize: '11.5px',
								fontWeight: '700',
								letterSpacing: '0.14em',
								textTransform: 'uppercase',
								color: accent
							}"
						>
							QUICK SCAN — {{ label }}
						</span>
					</div>
					<p class="text-tn-ink-dim" :style="{ margin: '6px 0 0', fontSize: '13px' }">Key developments from the past 12 hours.</p>
				</div>
				<NuxtLink
					to="/focus"
					:style="{ fontSize: '12.5px', color: accent, display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }"
				>
					View all {{ totalCountLabel }} <span aria-hidden="true">→</span>
				</NuxtLink>
			</header>

			<div v-if="!pending && tiles.length === 0" :style="{ padding: '6px 0 2px' }">
				<p class="text-tn-ink-mute" :style="{ margin: 0, fontSize: '13px', lineHeight: '1.55' }">
					No active priorities right now. Check the <a href="/focus" style="color: var(--color-tn-accent); text-decoration: none;">focus board</a>.
				</p>
			</div>

			<div v-else class="grid grid-cols-1 md:grid-cols-3" :style="{ gap: '24px' }">
				<div v-for="(it, idx) in tiles" :key="it.slug" :style="{ display: 'flex', gap: '14px', alignItems: 'flex-start' }">
					<span
						:style="{
							fontSize: '26px',
							color: accent,
							fontWeight: '700',
							lineHeight: '1',
							flexShrink: '0',
							opacity: '0.85',
							fontFamily: 'var(--font-mono)'
						}"
					>
						{{ idx + 1 }}
					</span>
					<div :style="{ minWidth: 0 }">
						<p :style="{ margin: 0, fontSize: '14px', lineHeight: '1.4', color: 'var(--color-tn-on-surface)' }">{{ it.title }}</p>
						<div :style="{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }">
							<span
								:style="{
									padding: '2px 9px',
									borderRadius: '3px',
									fontSize: '10.5px',
									fontWeight: '700',
									letterSpacing: '0.08em',
									background: severityBg(it.severity),
									color: severityColor(it.severity),
									fontFamily: 'var(--font-label)'
								}"
							>
								{{ it.severity }}
							</span>
							<span class="text-tn-ink-mute" :style="{ fontSize: '11.5px', fontFamily: 'var(--font-mono)' }">{{ it.ago }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
type PrioritySeverity = 'HIGH' | 'MEDIUM' | 'LOW'

type PriorityItem = {
		rank: number
		title: string
		slug: string
		severity: PrioritySeverity
		ago: string
}

type PrioritiesResponse = {
	items: PriorityItem[]
	totalCount: number
}

const props = withDefaults(defineProps<{ label: string; accent?: string }>(), {
	accent: '#2EE6C8'
})

const { data, pending } = await useFetch<PrioritiesResponse>('/api/brief/priorities', {
	key: 'brief-priorities'
})
const accent = computed(() => props.accent)

const totalCountLabel = computed(() => {
	const n = typeof data.value?.totalCount === 'number' ? data.value!.totalCount : 0
	return `${Math.max(0, Math.floor(n))}`
})

const tiles = computed<PriorityItem[]>(() => {
	const raw = Array.isArray(data.value?.items) ? data.value!.items : []
	return raw.slice(0, 3).map((p, idx) => {
		const title = typeof p.title === 'string' ? p.title.trim() : ''
		const slug = typeof p.slug === 'string' ? p.slug.trim() : ''
		const ago = typeof p.ago === 'string' ? p.ago.trim() : ''
		return {
			rank: idx + 1,
			title,
			slug,
			severity: p.severity,
			ago
		}
	}).filter((p) => p.title && p.slug)
})

function severityColor(sev: PrioritySeverity) {
	if (sev === 'HIGH') return '#FF6B6B'
	if (sev === 'MEDIUM') return '#F4B02E'
	return '#4CD7F6'
}

function severityBg(sev: PrioritySeverity) {
	if (sev === 'HIGH') return 'rgba(255,77,77,0.14)'
	if (sev === 'MEDIUM') return 'rgba(244,176,46,0.18)'
	return 'rgba(76,215,246,0.14)'
}
</script>
