<template>
	<main class="grid-bg-deep pt-4 pb-12 px-8 min-h-screen">
			<JsonLd :data="structuredData" />
		<div class="max-w-screen-xl mx-auto">
			<!-- Header: title/meta on left, weekly card on right -->
			<section :style="{ paddingTop: '56px', paddingBottom: '28px' }">
				<div
					:style="{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '32px', alignItems: 'flex-start' }"
					class="max-md:[grid-template-columns:1fr]"
				>
					<div>
						<h1 :style="{ margin: 0, fontSize: '44px', fontWeight: '700', letterSpacing: '-0.02em' }">Today's Brief</h1>
						<p class="text-tn-ink-dim" :style="{ margin: '12px 0 0', fontSize: '14.5px', lineHeight: '1.55' }">
							Two briefings a day — morning and evening.<br>
							Get the full story, or explore it in audio and video formats.
						</p>
						<HeaderMeta :last-updated-time="briefData?.lastUpdatedTime" />
					</div>
					<div :style="{ paddingTop: '8px' }">
						<WeeklyRoundupCard />
					</div>
				</div>
			</section>

			<!-- Brief cards -->
			<section :style="{ paddingBottom: '28px' }">
				<div class="grid grid-cols-1 md:grid-cols-2" :style="{ gap: '20px' }">
					<BriefCard
						v-if="primaryBrief"
						:brief="primaryBrief"
						:kind="primaryKind"
						role="primary"
					/>
					<BriefCard
						v-if="secondaryBrief"
						:brief="secondaryBrief"
						:kind="secondaryKind"
						role="secondary"
					/>
				</div>
			</section>

			<!-- Quick Scan (moved before Explore) -->
			<QuickScanPanel :label="quickScanLabel" :accent="scanAccent" />

			<!-- Explore (2 tiles only) -->
			<section :style="{ paddingBottom: '28px' }">
				<header :style="{ marginBottom: '16px' }">
					<h2
						:style="{
							margin: 0,
							fontSize: '16px',
							fontWeight: '700',
							letterSpacing: '0.14em',
							textTransform: 'uppercase',
							color: 'var(--color-tn-on-surface)'
						}"
					>
						EXPLORE THIS BRIEFING
					</h2>
					<p class="text-tn-ink-dim" :style="{ margin: '6px 0 0', fontSize: '13.5px' }">Different ways to consume today's brief.</p>
				</header>
				<div class="grid grid-cols-1 md:grid-cols-2" :style="{ gap: '16px' }">
					<RedBlueTile />
					<ShortTile />
				</div>
			</section>

			<!-- Resource strip -->
			<ResourceStrip />

				<!-- Subscribe widget -->
				<SubscribeWidget />

			<!-- IOC info banner -->
			<section :style="{ paddingBottom: '56px' }">
				<div
					:style="{
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
						padding: '14px 20px',
						background: 'var(--color-tn-bg-2, var(--color-tn-card-deep))',
						border: '1px solid var(--color-tn-line-deep)',
						borderRadius: '8px',
						fontSize: '13px',
						color: 'var(--color-tn-ink-mute)'
					}"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<circle cx="12" cy="12" r="10" />
						<path d="M12 8v4M12 16h.01" />
					</svg>
					Indicators of compromise (IOCs) and source links are included in each full brief.
				</div>
			</section>
		</div>
	</main>
</template>

<script setup lang="ts">
	import JsonLd from '~/components/seo/JsonLd.vue'
import HeaderMeta from '~/components/brief/HeaderMeta.vue'
import WeeklyRoundupCard from '~/components/brief/WeeklyRoundupCard.vue'
import BriefCard from '~/components/brief/BriefCard.vue'
import RedBlueTile from '~/components/brief/RedBlueTile.vue'
import ShortTile from '~/components/brief/ShortTile.vue'
	import QuickScanPanel from '~/components/brief/QuickScanPanel.vue'
	import ResourceStrip from '~/components/brief/ResourceStrip.vue'
		import SubscribeWidget from '~/components/brief/SubscribeWidget.vue'

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

type BriefTodayResponse = {
	morning: Brief | null
	evening: Brief | null
	lastUpdatedTime: string | null
}

	const site = useSiteConfig()

	const structuredData = computed(() => [
		useCollectionPageSchema({
			name: "Today's Cyber Threat Brief",
			url: `${site.url}/brief`,
			description: "Today's morning and evening cyber threat briefings."
		}),
		useBreadcrumbSchema([
			{ name: site.name, url: site.url },
			{ name: "Today's Brief", url: `${site.url}/brief` }
		])
	])

const { data: briefData } = await useFetch<BriefTodayResponse>('/api/brief/today', {
	key: 'brief-today'
})

function cetHourNow(): number {
	try {
		const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Stockholm' }).format(new Date())
		const h = Number.parseInt(parts, 10)
		return Number.isFinite(h) ? h : new Date().getHours()
	} catch {
		return new Date().getHours()
	}
}

const morningIsPrimary = computed(() => {
	const hour = cetHourNow()
	return hour >= 5 && hour < 15
})

const primaryKind = computed<'morning' | 'evening'>(() => (morningIsPrimary.value ? 'morning' : 'evening'))
const secondaryKind = computed<'morning' | 'evening'>(() => (morningIsPrimary.value ? 'evening' : 'morning'))

const primaryBrief = computed(() => (primaryKind.value === 'morning' ? briefData.value?.morning ?? null : briefData.value?.evening ?? null))
const secondaryBrief = computed(() => (secondaryKind.value === 'morning' ? briefData.value?.morning ?? null : briefData.value?.evening ?? null))

const quickScanLabel = computed(() => (morningIsPrimary.value ? 'Overnight Activity' : "Today's Developments"))
const scanAccent = computed(() => (morningIsPrimary.value ? '#2EE6C8' : '#3FA9F5'))

	const ogBriefImage = `${site.url}/og-brief.png`

	useHead({
		link: [{ rel: 'canonical', href: `${site.url}/brief` }]
	})

useSeoMeta({
		title: `Today's Cyber Threat Brief — ${site.name}`,
	description: 'Morning and evening cyber threat briefings. Curated, vendor-agnostic, multi-format. New brief every 12 hours.',
	ogTitle: "Today's Cyber Threat Brief",
	ogDescription: 'Morning and evening cyber threat briefings. Curated, vendor-agnostic, multi-format. New brief every 12 hours.',
	ogType: 'website',
		ogImage: ogBriefImage,
	ogImageWidth: 1200,
	ogImageHeight: 630,
	twitterCard: 'summary_large_image',
		twitterImage: ogBriefImage
})
</script>
