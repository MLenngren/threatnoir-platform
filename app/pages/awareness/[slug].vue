<template>
  <main class="grid-bg py-10 md:py-14">
    <JsonLd v-if="structuredData" :data="structuredData" />
    <div class="mx-auto max-w-6xl px-6">
      <header class="mb-6">
        <NuxtLink
          to="/awareness"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          Back to all lessons
        </NuxtLink>
      </header>

      <section v-if="pending" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">
        Loading…
      </section>

      <section v-else-if="!lesson" class="glass-panel rounded-2xl p-10 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tn-surface-lowest/60 ring-1 ring-white/10">
          <UIcon name="i-heroicons-light-bulb" class="h-6 w-6 text-tn-primary" />
        </div>
        <div class="font-headline text-base font-bold text-tn-on-surface">Lesson not found.</div>
        <div class="mt-1 text-sm text-tn-on-surface-variant">This lesson may be unpublished or the link is incorrect.</div>
      </section>

      <AwarenessLessonExpanded v-else :lesson="lesson" />

      <!-- Share bar -->
      <div v-if="lesson" class="mt-8 flex flex-wrap items-center gap-3">
        <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">Share</span>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
          @click="copyLink"
        >
          <UIcon :name="copied ? 'i-heroicons-check' : 'i-heroicons-link'" class="h-4 w-4" />
          {{ copied ? 'Copied' : 'Copy link' }}
        </button>

        <a
          :href="`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-[#0A66C2]/10 hover:text-[#0A66C2]"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          LinkedIn
        </a>

        <a
          :href="`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          X / Twitter
        </a>

        <a
          :href="`https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}`"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-[#0085FF]/10 hover:text-[#0085FF]"
        >
          <svg class="h-4 w-4" viewBox="0 0 600 530" fill="currentColor"><path d="m135.7 44.3c68.7 51.5 142.6 155.9 164.3 211.9 21.7-56 95.6-160.4 164.3-211.9 49.4-37 129.7-65.6 129.7 37.6 0 20.6-11.8 173.2-18.7 197.9-24 86-111.2 107.9-188.6 94.6 135.2 23.1 169.8 99.7 95.4 176.3C375.4 657.3 228 538 300 440.6c72-97.4-75.4 16.7-182.1 109.7-74.4-76.6-39.8-153.2 95.4-176.3-77.4 13.3-164.6-8.6-188.6-94.6C17.8 254.5 6 102.1 6 81.5c0-103.2 80.3-74.6 129.7-37.2z"/></svg>
          Bluesky
        </a>

	        <a
	          :href="`mailto:?subject=${encodedTitle}&body=Check out this security awareness lesson from ${site.name}:%0A%0A${encodedUrl}`"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 transition-colors hover:bg-tn-primary/10 hover:text-tn-primary"
        >
          <UIcon name="i-heroicons-envelope" class="h-4 w-4" />
          Email
        </a>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
	import { useToast } from '~/composables/useToast'
import JsonLd from '~/components/seo/JsonLd.vue'
import AwarenessLessonExpanded from '~/components/AwarenessLessonExpanded.vue'
import type { AwarenessLesson } from '~/types/public'

type LessonResponse = { lesson: AwarenessLesson }

const route = useRoute()
const slug = computed(() => String(route.params.slug || '').trim())

const { data, pending } = await useFetch<LessonResponse>(() => `/api/awareness/by-slug/${encodeURIComponent(slug.value)}`)

const lesson = computed(() => data.value?.lesson || null)

const seoDescription = computed(() => {
  const raw = (lesson.value?.body || '').trim()
  if (!raw) return 'Daily root-cause lessons extracted from real security incidents.'
  return raw.length <= 155 ? raw : raw.slice(0, 155).trim() + '...'
})

	const site = useSiteConfig()
	const canonicalUrl = computed(() => (lesson.value?.slug ? `${site.url}/awareness/${lesson.value.slug}` : `${site.url}/awareness`))
	const ogImage = computed(() => `${site.url}/og-awareness.png`)

useSeoMeta({
	  title: computed(() => (lesson.value ? `${lesson.value.title} | ${site.name} Awareness` : `${site.name} Awareness`)),
  description: seoDescription,
	  ogTitle: computed(() => (lesson.value ? `${lesson.value.title} | ${site.name} Awareness` : `${site.name} Awareness`)),
  ogDescription: seoDescription,
	  ogUrl: canonicalUrl,
  ogType: 'article',
	  ogImage,
  twitterCard: 'summary_large_image',
	  twitterTitle: computed(() => lesson.value?.title || `${site.name} Awareness`),
  twitterDescription: seoDescription,
	  twitterImage: ogImage
})

	const shareUrl = computed(() => (lesson.value?.slug ? canonicalUrl.value : ''))
const encodedUrl = computed(() => encodeURIComponent(shareUrl.value))
	const encodedTitle = computed(() => encodeURIComponent(lesson.value?.title || `${site.name} Awareness`))

const structuredData = computed(() => {
  if (!lesson.value || !slug.value) return null

	  const url = `${site.url}/awareness/${slug.value}`

  return [
    useBlogPostingSchema({
      title: lesson.value.title,
      description: seoDescription.value,
      slug: slug.value,
      published_at: lesson.value.published_at || lesson.value.created_at,
      updated_at: null
    }),
    useBreadcrumbSchema([
	      { name: 'Home', url: site.url },
	      { name: 'Awareness', url: `${site.url}/awareness` },
      { name: lesson.value.title, url }
    ])
  ]
})

const copied = ref(false)
async function copyLink() {
  if (!import.meta.client || !shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
	    useToast().show('Link copied')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
	  } catch {
		    useToast().show('Copy failed', 'error')
	    // ignore
	  }
}
</script>
