<template>
  <main class="grid-bg py-10 md:py-14">
    <div class="mx-auto max-w-6xl px-6">
      <section class="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-10">
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-tn-primary/10 blur-3xl" />
          <div class="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-tn-primary/10 blur-3xl" />
        </div>

        <div class="relative">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-tn-primary/10 ring-1 ring-tn-primary/20">
              <UIcon name="i-heroicons-shield-check" class="h-5 w-5 text-tn-primary" />
            </div>
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">For SOC</div>
          </div>

          <h1 class="mt-4 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-5xl">
            Threat Intel for <span class="text-tn-primary">SOC Analysts</span> &amp; Threat Hunters
          </h1>
	          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-tn-on-surface-variant md:text-base">
	            Daily signal, actionable context, and IOCs you can operationalize. Use {{ site.name }} as your fast start to triage what matters today.
          </p>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              to="/podcast"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
            >
              Listen to the daily briefing →
            </NuxtLink>
            <NuxtLink
              to="/iocs"
              class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
            >
              Search IOCs →
            </NuxtLink>
          </div>
        </div>
      </section>

      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">What you’ll find</h2>
        <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <NuxtLink
            v-for="c in cards"
            :key="c.href"
            :to="c.href"
            class="group rounded-2xl bg-black/20 p-5 ring-1 ring-white/10 transition-all hover:bg-black/30 hover:shadow-[0_0_24px_rgba(76,215,246,0.10)]"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-tn-primary/10 ring-1 ring-tn-primary/20">
                  <UIcon :name="c.icon" class="h-5 w-5 text-tn-primary" />
                </div>
                <div>
                  <div class="font-headline text-base font-bold text-tn-on-surface">{{ c.title }}</div>
                  <div class="mt-1 text-sm leading-relaxed text-tn-on-surface-variant">{{ c.desc }}</div>
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-up-right" class="h-5 w-5 text-tn-on-surface-variant transition-colors group-hover:text-tn-primary" />
            </div>
          </NuxtLink>
        </div>
      </section>

      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Start with this</h2>
            <p class="mt-1 text-sm text-tn-on-surface-variant">Latest daily briefing episode.</p>
          </div>
          <NuxtLink
            to="/podcast"
            class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            Open podcast →
          </NuxtLink>
        </div>

        <div v-if="pending" class="mt-5 text-sm text-tn-on-surface-variant">Loading…</div>
        <div v-else-if="!featured" class="mt-5 text-sm text-tn-on-surface-variant">No episodes yet.</div>

        <div v-else class="mt-5 rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">
              {{ featured.date }}
              <span v-if="typeof featured.article_count === 'number'" class="ml-2 text-tn-on-surface-variant">• {{ featured.article_count }} articles</span>
            </div>
          </div>
	          <div class="mt-2 text-balance font-headline text-lg font-bold text-tn-on-surface">
	            {{ (featured.title || '').trim() || `${site.name} Daily Briefing` }}
          </div>
          <p v-if="featuredNote" class="mt-2 text-sm leading-relaxed text-tn-on-surface-variant">{{ featuredNote }}</p>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
	const site = useSiteConfig()

useSeoMeta({
	  title: `Threat Intel for SOC Analysts & Threat Hunters | ${site.name}`,
  description:
    'Daily threat intelligence briefings for SOC analysts and threat hunters. Get actionable context, IOC discovery, and fast signal to prioritize investigations.',
	  ogTitle: `Threat Intel for SOC Analysts & Threat Hunters | ${site.name}`,
  ogDescription:
    'Daily threat intelligence briefings for SOC analysts and threat hunters. Get actionable context, IOC discovery, and fast signal to prioritize investigations.',
  ogType: 'website'
})

const cards = [
  {
    title: 'Daily briefings',
    desc: 'A 5-minute practitioner-grade start to your day.',
    href: '/podcast',
    icon: 'i-heroicons-microphone'
  },
  {
    title: 'IOC search',
    desc: 'Search domains, hashes, CVEs, IPs, and more.',
    href: '/iocs',
    icon: 'i-heroicons-magnifying-glass'
  },
  {
    title: 'Briefs',
    desc: 'Fast reads on the highest-signal stories.',
    href: '/briefs',
    icon: 'i-heroicons-document-text'
  },
  {
    title: 'Focus items',
    desc: 'The items you should prioritize today.',
    href: '/focus',
    icon: 'i-heroicons-bolt'
  }
]

type PodcastItem = {
  id: string
  date: string
  title: string | null
  duration_seconds: number | null
  audio_url: string | null
  article_count: number | null
  created_at: string
}

type PodcastsResponse = { items: PodcastItem[] }

const { data, pending } = await useFetch<PodcastsResponse>('/api/podcasts', {
  query: { limit: 1 }
})

const featured = computed(() => (Array.isArray(data.value?.items) ? (data.value!.items[0] ?? null) : null))
const featuredNote = computed(() => {
  if (!featured.value) return ''
  const dur = featured.value.duration_seconds
  if (!dur || !Number.isFinite(dur)) return ''
  const m = Math.max(1, Math.round(dur / 60))
  return `~${m} min, ready to triage.`
})
</script>
