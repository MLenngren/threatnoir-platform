<template>
	<NuxtLink :to="href" class="block" :style="{ textDecoration: 'none' }">
		<article
			:style="{
				display: 'flex',
				flexDirection: 'column',
				gap: '16px',
				padding: '20px',
				background: 'var(--color-tn-bg-2, var(--color-tn-card-deep))',
				border: '1px solid var(--color-tn-line-deep)',
				borderRadius: '10px'
			}"
		>
			<div
				:style="{
					alignSelf: 'flex-start',
					padding: '4px 10px',
					background: 'rgba(255,77,77,0.15)',
					color: 'var(--color-tn-attack)',
					fontSize: '11px',
					fontWeight: '700',
					letterSpacing: '0.08em',
					borderRadius: '4px'
				}"
			>
				RED VS BLUE
			</div>

			<div
				:style="{
					position: 'relative',
					borderRadius: '6px',
					overflow: 'hidden',
					aspectRatio: '16/9',
					background: '#0A1820'
				}"
			>
				<img
					v-if="thumbnailUrl"
					:src="thumbnailUrl"
					alt=""
					class="absolute inset-0 h-full w-full object-cover"
					loading="lazy"
					referrerpolicy="no-referrer"
				>
				<template v-else>
					<div
						class="absolute inset-0"
						:style="{ background: 'linear-gradient(90deg, rgba(255,77,77,0.55) 0%, rgba(80,30,40,0.7) 50%, rgba(63,169,245,0.5) 100%)' }"
					/>
					<svg viewBox="0 0 160 90" preserveAspectRatio="none" class="absolute inset-0 h-full w-full">
						<!-- digital code rain on right -->
						<text
							v-for="i in 40"
							:key="i"
							:x="90 + ((i - 1) % 8) * 8"
							:y="15 + Math.floor((i - 1) / 8) * 12"
							fill="rgba(63,169,245,0.4)"
							font-size="6"
							font-family="monospace"
						>
							{{ ((i - 1) * 7) % 2 ? '01' : '10' }}
						</text>
						<!-- silhouette figures -->
						<ellipse cx="38" cy="38" rx="9" ry="11" fill="rgba(0,0,0,0.7)" />
						<rect x="28" y="48" width="20" height="35" fill="rgba(0,0,0,0.7)" />
						<ellipse cx="118" cy="38" rx="9" ry="11" fill="rgba(0,0,0,0.7)" />
						<rect x="108" y="48" width="20" height="35" fill="rgba(0,0,0,0.7)" />
					</svg>
				</template>

				<div
					:style="{
						position: 'absolute',
						left: '50%',
						top: '50%',
						transform: 'translate(-50%,-50%)',
						width: '36px',
						height: '36px',
						borderRadius: '50%',
						background: 'rgba(0,0,0,0.6)',
						border: '1.5px solid #fff',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center'
					}"
				>
					<svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
				</div>
				<div
					:style="{
						position: 'absolute',
						right: '8px',
						bottom: '8px',
						fontFamily: 'var(--font-mono)',
						fontSize: '10px',
						background: 'rgba(0,0,0,0.7)',
						padding: '2px 5px',
						borderRadius: '2px',
						color: '#fff'
					}"
				>
					{{ durationLabel }}
				</div>
			</div>

			<div>
				<h4 :style="{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--color-tn-on-surface)' }">
					{{ title }}
				</h4>
				<p class="text-tn-ink-dim" :style="{ margin: '6px 0 0', fontSize: '13px', lineHeight: '1.5' }">
					<span v-if="descriptionLines.length">{{ descriptionLines[0] }}</span><br>
					<span v-if="descriptionLines.length > 1">{{ descriptionLines[1] }}</span>
				</p>
			</div>

			<div :style="{ borderTop: '1px solid var(--color-tn-line-deep)', paddingTop: '14px', marginTop: 'auto' }">
				<span class="tn-link" :style="{ fontSize: '13px', color: 'var(--color-tn-attack)', display: 'inline-flex', alignItems: 'center', gap: '6px' }">
					Watch breakdown <span aria-hidden="true">→</span>
				</span>
			</div>
		</article>
	</NuxtLink>
</template>

<script setup lang="ts">
type RedVsBlueItem = {
	title: string
	description: string
	slug: string
	durationLabel: string
	thumbnailUrl: string | null
}

type RedVsBlueResponse = {
	items: RedVsBlueItem[]
}

const { data } = await useFetch<RedVsBlueResponse>('/api/landing/red-vs-blue', {
	key: 'brief-red-blue'
})

const item = computed<RedVsBlueItem | null>(() => {
	const items = data.value?.items
	return Array.isArray(items) && items.length ? items[0] : null
})

const title = computed(() => item.value?.title || 'VPN RCE — How attackers chain it')

const descriptionLines = computed(() => {
	const raw = (item.value?.description || 'See how the attack works —\nand how to stop it.').trim()
	// Normalize into two lines (design uses a hard line break)
	const parts = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
	if (parts.length >= 2) return [parts[0], parts[1]]
	if (parts.length === 1) {
		const p = parts[0]
		const mid = Math.max(0, p.indexOf('—') + 1)
		if (mid > 0 && mid < p.length - 1) return [p.slice(0, mid).trim(), p.slice(mid).trim()]
		return [p, '']
	}
	return ['See how the attack works —', 'and how to stop it.']
})

const durationLabel = computed(() => item.value?.durationLabel || '1:02')
const thumbnailUrl = computed(() => item.value?.thumbnailUrl || null)

const href = computed(() => {
	const slug = item.value?.slug
	return slug ? `/show/${slug}` : '/show'
})
</script>
