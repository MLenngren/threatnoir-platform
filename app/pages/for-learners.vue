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
              <UIcon name="i-heroicons-academic-cap" class="h-5 w-5 text-tn-primary" />
            </div>
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">For learners</div>
          </div>

          <h1 class="mt-4 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-5xl">
            Learn Security From <span class="text-tn-primary">What’s Actually Happening</span>
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-tn-on-surface-variant md:text-base">
            Root-cause takeaways from real incidents, condensed into lessons you can apply immediately. Build intuition by studying live patterns—not textbook examples.
          </p>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              to="/awareness"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
            >
              Explore Awareness Lessons →
            </NuxtLink>
            <NuxtLink
              to="/tips"
              class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
            >
              Browse tips →
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
            <p class="mt-1 text-sm text-tn-on-surface-variant">Latest published lesson.</p>
          </div>
          <NuxtLink
            to="/awareness"
            class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            Browse lessons →
          </NuxtLink>
        </div>

        <div v-if="pending" class="mt-5 text-sm text-tn-on-surface-variant">Loading…</div>
        <div v-else-if="!featured" class="mt-5 text-sm text-tn-on-surface-variant">No lessons yet.</div>

        <NuxtLink
          v-else
          :to="featuredHref"
          class="mt-5 block rounded-2xl bg-black/20 p-5 ring-1 ring-white/10 transition-all hover:bg-black/30 hover:shadow-[0_0_24px_rgba(76,215,246,0.10)]"
        >
          <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Awareness Lesson</div>
          <div class="mt-2 text-balance font-headline text-lg font-bold text-tn-on-surface">{{ featured.title }}</div>
          <p v-if="featuredExcerpt" class="mt-2 text-sm leading-relaxed text-tn-on-surface-variant">{{ featuredExcerpt }}</p>
        </NuxtLink>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Learn Security From What’s Actually Happening | ThreatNoir',
  description:
    'Learn cybersecurity by studying real incidents. ThreatNoir Awareness Lessons extract root-cause takeaways you can apply immediately—no fluff, no hypotheticals.',
  ogTitle: 'Learn Security From What’s Actually Happening | ThreatNoir',
  ogDescription:
    'Learn cybersecurity by studying real incidents. ThreatNoir Awareness Lessons extract root-cause takeaways you can apply immediately—no fluff, no hypotheticals.',
  ogType: 'website'
})

const cards = [
  {
    title: 'Awareness Lessons',
    desc: 'Daily, scan-fast lessons from approved incidents.',
    href: '/awareness',
    icon: 'i-heroicons-light-bulb'
  },
  {
    title: 'Tips & Tricks',
    desc: 'Small improvements that compound quickly.',
    href: '/tips',
    icon: 'i-heroicons-sparkles'
  },
  {
    title: 'Resources',
    desc: 'Curated references and tools worth bookmarking.',
    href: '/resources',
    icon: 'i-heroicons-book-open'
  },
  {
    title: 'Daily briefing',
    desc: 'Hear what’s changing right now in the threat landscape.',
    href: '/podcast',
    icon: 'i-heroicons-microphone'
  }
]

type AwarenessLesson = {
  id: string
  slug: string
  title: string
  body: string
  created_at: string
  published_at: string | null
}

type AwarenessResponse = {
  items: AwarenessLesson[]
  page: number
  limit: number
  hasMore: boolean
}

const { data, pending } = await useFetch<AwarenessResponse>('/api/awareness', {
  query: { limit: 1 }
})

const featured = computed(() => (Array.isArray(data.value?.items) ? (data.value!.items[0] ?? null) : null))
const featuredHref = computed(() => (featured.value?.slug ? `/awareness/${featured.value.slug}` : '/awareness'))
const featuredExcerpt = computed(() => {
  const raw = (featured.value?.body || '').trim()
  if (!raw) return ''
  const oneLine = raw.replace(/\s+/g, ' ').trim()
  if (!oneLine) return ''
  return oneLine.length <= 200 ? oneLine : oneLine.slice(0, 200).trim() + '...'
})
</script>
