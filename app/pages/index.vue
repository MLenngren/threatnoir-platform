<template>
	<main class="grid-bg-deep">
		<JsonLd :data="structuredData" />
		<LandingV2Hero />
		<LandingV2LatestBriefs />
		<LandingV2RedVsBlueShow />
		<LandingV2WeeklyBrief />
	</main>
</template>

<script setup lang="ts">
import JsonLd from '~/components/seo/JsonLd.vue'
	import LandingV2Hero from '~/components/landing-v2/Hero.vue'
	import LandingV2LatestBriefs from '~/components/landing-v2/LatestBriefs.vue'
	import LandingV2RedVsBlueShow from '~/components/landing-v2/RedVsBlueShow.vue'
	import LandingV2WeeklyBrief from '~/components/landing-v2/WeeklyBrief.vue'

const structuredData = computed(() => [useOrganizationSchema(), useWebSiteSchema()])

useSeoMeta({
	title: 'ThreatNoir — Daily Brief. AI-filtered cyber intelligence',
	description: 'AI-filtered cyber intelligence for security practitioners. Morning & Evening briefings. No noise. Just signal.',
	ogTitle: 'ThreatNoir — Daily Brief',
	ogDescription: 'AI-filtered cyber intelligence for security practitioners. Morning & Evening briefings.',
	ogType: 'website',
	ogImage: 'https://threatnoir.com/og-home.png',
	ogImageWidth: 1200,
	ogImageHeight: 630,
	twitterCard: 'summary_large_image',
	twitterImage: 'https://threatnoir.com/og-home.png'
})
</script>
