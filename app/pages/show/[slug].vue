<template>
  <main class="grid-bg py-10 md:py-14">
    <JsonLd v-if="structuredData" :data="structuredData" />

    <div class="mx-auto max-w-6xl px-6">
      <header class="mb-6">
        <NuxtLink
          to="/show"
          class="inline-flex items-center gap-2 rounded-lg bg-tn-surface-lowest/40 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10 hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
        >
          <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
          Back to show
        </NuxtLink>
      </header>

      <section v-if="pending" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">Loading…</section>
      <section v-else-if="error || !episode" class="glass-panel rounded-2xl p-6 text-sm text-tn-on-surface-variant">
        Episode not found.
      </section>

      <section v-else class="glass-panel overflow-hidden rounded-2xl ring-1 ring-white/10">
        <div class="bg-black">
          <video
            :src="episode.video_url || undefined"
            :poster="episode.thumbnail_url || undefined"
            controls
            preload="metadata"
            class="aspect-video w-full"
          />
        </div>

        <div class="p-6 md:p-8">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0">
              <div class="flex items-center gap-3">
                <span class="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Red vs Blue Show</span>
              </div>

              <h1 class="mt-3 text-balance font-headline text-2xl font-black tracking-tight text-tn-on-surface md:text-4xl">
                {{ episode.title }}
              </h1>

              <p class="mt-2 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                {{ formatDate(episode.date) }}
                <span v-if="typeof episode.duration_seconds === 'number'">· {{ formatDuration(episode.duration_seconds) }}</span>
              </p>

              <p v-if="seoDescription" class="mt-4 max-w-3xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
                {{ seoDescription }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <UButton size="sm" color="neutral" variant="outline" @click="share">
                <UIcon name="i-heroicons-share" class="h-4 w-4" />
                Share
              </UButton>
              <UButton size="sm" color="neutral" variant="outline" @click="copyLink">
                <UIcon name="i-heroicons-link" class="h-4 w-4" />
                Copy link
              </UButton>
              <a
                :href="xShareHref"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-tn-surface-lowest/40 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant hover:bg-tn-surface-lowest/60 hover:text-tn-on-surface"
              >
                <UIcon name="i-simple-icons-x" class="h-4 w-4" />
                X
              </a>
            </div>
          </div>
        </div>
      </section>

      <section v-if="watchNext.length" class="mt-10">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Watch next</h2>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="ep in watchNext"
            :key="ep.id"
            :to="ep.slug ? `/show/${encodeURIComponent(ep.slug)}` : '/show'"
            class="group relative overflow-hidden rounded-xl bg-tn-surface-low/70 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(76,215,246,0.10)]"
          >
            <div class="relative aspect-video bg-[#0a0f1a]">
              <img v-if="ep.thumbnail_url" :src="ep.thumbnail_url" :alt="ep.title" class="h-full w-full object-cover" loading="lazy">
              <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                <UIcon name="i-heroicons-play-circle" class="h-12 w-12 text-white" />
              </div>
              <span
                v-if="typeof ep.duration_seconds === 'number'"
                class="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white"
              >
                {{ formatDuration(ep.duration_seconds) }}
              </span>
            </div>

            <div class="p-4">
              <h3 class="line-clamp-2 text-sm font-semibold text-tn-on-surface">{{ ep.title }}</h3>
              <p class="mt-1 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
                {{ formatDate(ep.date) }}
              </p>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import JsonLd from '~/components/seo/JsonLd.vue'
import { useToast } from '~/composables/useToast'

definePageMeta({ layout: 'default' })

type VideoBriefing = {
  id: string
  slug: string | null
  summary: string | null
  date: string
  title: string
  duration_seconds: number | null
  video_url: string | null
  thumbnail_url: string | null
  script: unknown
  created_at?: string
  updated_at?: string
}

type EpisodeResponse = { episode: VideoBriefing }
type EpisodesResponse = { items: VideoBriefing[] }

const route = useRoute()
const slug = computed(() => String(route.params.slug || '').trim())

const { data, pending, error } = await useFetch<EpisodeResponse>(() => `/api/show/episodes/${encodeURIComponent(slug.value)}`)
const episode = computed(() => data.value?.episode || null)

const { data: listData } = await useFetch<EpisodesResponse>('/api/show/episodes', {
  query: { limit: 30, offset: 0 }
})

const watchNext = computed(() => {
  const all = Array.isArray(listData.value?.items) ? listData.value!.items : []
  const cur = episode.value?.slug
  return all.filter((e) => e.slug && e.slug !== cur).slice(0, 9)
})

	const site = useSiteConfig()

	const canonicalUrl = computed(() => {
	  const s = episode.value?.slug
	  return s ? `${site.url}/show/${s}` : `${site.url}/show`
	})

const seoDescription = computed(() => {
  const s = (episode.value?.summary || '').trim()
  if (s) return s.length <= 155 ? s : s.slice(0, 155).trim() + '…'
  const fallback = (episode.value?.title || '').trim()
  return fallback || 'Red team attacks, blue team defends. Tactical security breakdowns.'
})

	const ogImage = computed(() => {
	  const img = (episode.value?.thumbnail_url || '').trim()
	  return img || site.ogImageUrl
	})

useSeoMeta({
	  title: computed(() => (episode.value ? `${episode.value.title} | Red vs Blue Show — ${site.name}` : `Red vs Blue Show — ${site.name}`)),
  description: seoDescription,
	  ogTitle: computed(() => (episode.value ? `${episode.value.title} | Red vs Blue Show — ${site.name}` : `Red vs Blue Show — ${site.name}`)),
  ogDescription: seoDescription,
  ogImage,
  ogUrl: canonicalUrl,
  ogType: 'video.other',
  twitterCard: 'summary_large_image',
	  twitterTitle: computed(() => episode.value?.title || `Red vs Blue Show — ${site.name}`),
  twitterDescription: seoDescription,
  twitterImage: ogImage
})

useHead({
  link: [
    { rel: 'canonical', href: canonicalUrl },
	    { rel: 'alternate', type: 'application/rss+xml', title: `${site.name} — Red vs Blue Show`, href: '/api/show/feed.xml' }
  ]
})

const structuredData = computed(() => {
  const ep = episode.value
  const s = ep?.slug
  if (!ep || !s) return null

	  const url = `${site.url}/show/${s}`
  const durSeconds = typeof ep.duration_seconds === 'number' && ep.duration_seconds > 0 ? Math.floor(ep.duration_seconds) : null
  const isoDuration = durSeconds ? `PT${durSeconds}S` : undefined
  const uploadDate = ep.date ? `${ep.date}T12:00:00Z` : undefined

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: ep.title,
      description: seoDescription.value,
      url,
      uploadDate,
      duration: isoDuration,
      thumbnailUrl: ep.thumbnail_url ? [ep.thumbnail_url] : undefined,
      contentUrl: ep.video_url || undefined,
      publisher: {
        '@type': 'Organization',
	        name: site.name,
	        url: site.url
      }
    },
    useBreadcrumbSchema([
	      { name: 'Home', url: site.url },
	      { name: 'Red vs Blue Show', url: `${site.url}/show` },
      { name: ep.title, url }
    ])
  ]
})

const shareUrl = computed(() => canonicalUrl.value)
const encodedUrl = computed(() => encodeURIComponent(shareUrl.value))

const xShareHref = computed(() => {
  const text = episode.value?.title ? `${episode.value.title}` : 'Red vs Blue Show'
  return `https://x.com/intent/tweet?url=${encodedUrl.value}&text=${encodeURIComponent(text)}`
})

async function copyLink() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    useToast().show('Link copied')
  } catch (e) {
    useToast().show('Copy failed', 'error')
    console.warn('[show/[slug]] copy failed:', e)
  }
}

async function share() {
  if (!import.meta.client) return
  const url = shareUrl.value
  const title = (episode.value?.title || '').trim() || 'Red vs Blue Show'
  try {
    if (navigator.share) {
      await navigator.share({ title, url })
      return
    }
  } catch {
    // ignore
  }
  await copyLink()
}

function formatDuration(s: number): string {
  const n = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0
  const m = Math.floor(n / 60)
  const sec = n % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDate(d: string): string {
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>
