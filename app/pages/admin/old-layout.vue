<template>
  <main class="grid-bg">
    <JsonLd :data="structuredData" />
    <LandingHero />
			<LandingTodayAtAGlance />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingFocus />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingStats />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingPersonas />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingFeatures />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingPodcast />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingPreview />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingAwareness />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    <LandingMCP />

    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
	    <LandingPricing />

	    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
	    <LandingWhySignUp />

	    <div class="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
	    <LandingCTA />
  </main>
</template>

<script setup lang="ts">
import JsonLd from '~/components/seo/JsonLd.vue'

import LandingCTA from '~/components/landing/LandingCTA.vue'
import LandingAwareness from '~/components/landing/LandingAwareness.vue'
import LandingFeatures from '~/components/landing/LandingFeatures.vue'
import LandingFocus from '~/components/landing/LandingFocus.vue'
import LandingHero from '~/components/landing/LandingHero.vue'
	import LandingTodayAtAGlance from '~/components/landing/LandingTodayAtAGlance.vue'
import LandingPersonas from '~/components/landing/LandingPersonas.vue'
import LandingStats from '~/components/landing/LandingStats.vue'
import LandingMCP from '~/components/landing/LandingMCP.vue'
import LandingPodcast from '~/components/landing/LandingPodcast.vue'
import LandingPreview from '~/components/landing/LandingPreview.vue'
	import LandingPricing from '~/components/landing/LandingPricing.vue'
	import LandingWhySignUp from '~/components/landing/LandingWhySignUp.vue'

// Use the public default layout (not the admin sidebar layout) so this is a
// faithful archive of the original homepage. Auth still gated by admin-auth
// global middleware because path is under /admin/. robots blocked via SEO meta.
definePageMeta({ layout: 'default' })

const structuredData = computed(() => [useOrganizationSchema(), useWebSiteSchema()])

useSeoMeta({
  title: 'ThreatNoir — Old Layout Archive (Admin)',
  description: 'Internal archive of the previous landing page layout. Not intended for public viewing.',
  robots: 'noindex, nofollow',
  ogTitle: 'ThreatNoir — Old Layout Archive',
  ogType: 'website'
})
</script>
