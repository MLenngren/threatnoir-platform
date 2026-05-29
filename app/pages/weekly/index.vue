<template>
  <main class="grid-bg py-10 md:py-14">
    <div class="mx-auto max-w-6xl px-6">
      <header class="mb-8">
        <h1 class="font-headline text-2xl font-black tracking-tight text-tn-on-surface md:text-3xl">
          Weekly Threat Roundup
        </h1>
	        <div class="mt-3">
	          <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
	            For security leaders
	          </span>
	        </div>
	        <p class="mt-2 max-w-2xl text-sm leading-relaxed text-tn-on-surface-variant">
	          A weekly practitioner-grade brief across {{ site.name }}'s approved intelligence. Drafted by AI, reviewed before publishing.
        </p>
      </header>

      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div v-if="pending" class="text-sm text-tn-on-surface-variant">Loading…</div>
        <div v-else-if="!items.length" class="text-sm text-tn-on-surface-variant">No published roundups yet.</div>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NuxtLink
            v-for="r in items"
            :key="r.id"
            :to="`/weekly/${r.slug}`"
            class="group rounded-xl border border-white/10 bg-black/20 p-5 transition-all hover:bg-black/30 hover:shadow-[0_0_24px_rgba(76,215,246,0.10)]"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">
                  {{ r.week_label }}
                </div>
                <div class="mt-1 truncate font-headline text-base font-bold text-tn-on-surface">
                  {{ titleFor(r) }}
                </div>
              </div>
              <UIcon name="i-heroicons-arrow-up-right" class="h-5 w-5 text-tn-on-surface-variant transition-colors group-hover:text-tn-primary" />
            </div>

            <div class="mt-2 text-xs text-tn-on-surface-variant">
              {{ r.date_from }} to {{ r.date_to }}
              <span v-if="typeof r.article_count === 'number'" class="ml-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                {{ r.article_count }} articles
              </span>
            </div>

            <div v-if="excerptFor(r)" class="mt-3 text-sm leading-relaxed text-tn-on-surface-variant">
              {{ excerptFor(r) }}
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
type WeeklyRoundupItem = {
  id: string
  week_label: string
  slug: string
  date_from: string
  date_to: string
  tldr: string | null
  article_count: number | null
  published_at: string | null
}

type WeeklyResponse = { items: WeeklyRoundupItem[] }
	const site = useSiteConfig()

useSeoMeta({
	  title: `Weekly Threat Roundup | ${site.name}`,
  description: 'Weekly threat intelligence roundup curated for practitioners.',
	  ogTitle: `Weekly Threat Roundup | ${site.name}`,
  ogDescription: 'Weekly threat intelligence roundup curated for practitioners.',
  ogType: 'website'
})

useHead({
  link: [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
	      title: `${site.name} Weekly Roundup`,
      href: '/api/weekly/feed.xml'
    }
  ]
})

const { data, pending } = await useFetch<WeeklyResponse>('/api/weekly')
const items = computed(() => data.value?.items ?? [])

function titleFor(r: WeeklyRoundupItem) {
  return `Roundup ${r.week_label}`
}

function excerptFor(r: WeeklyRoundupItem) {
  const raw = (r.tldr || '').trim()
  if (!raw) return ''
  const oneLine = raw
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!oneLine) return ''
  return oneLine.length <= 160 ? oneLine : oneLine.slice(0, 160).trim() + '...'
}
</script>
