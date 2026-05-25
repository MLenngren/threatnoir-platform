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
              <UIcon name="i-heroicons-briefcase" class="h-5 w-5 text-tn-primary" />
            </div>
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">For leaders</div>
          </div>

          <h1 class="mt-4 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-5xl">
            Security Briefings for <span class="text-tn-primary">CISOs</span> &amp; Leaders
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-tn-on-surface-variant md:text-base">
            Board-ready signal without the doomscrolling. Weekly rollups and curated context across breaches, vuln exploitation, and regulatory pressure.
          </p>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              to="/weekly"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
            >
              Read the weekly roundup →
            </NuxtLink>
            <NuxtLink
              to="/subscribe"
              class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
            >
              Subscribe →
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
            <p class="mt-1 text-sm text-tn-on-surface-variant">Latest published roundup.</p>
          </div>
          <NuxtLink
            to="/weekly"
            class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            Browse weekly →
          </NuxtLink>
        </div>

        <div v-if="pending" class="mt-5 text-sm text-tn-on-surface-variant">Loading…</div>
        <div v-else-if="!featured" class="mt-5 text-sm text-tn-on-surface-variant">No published roundups yet.</div>

        <NuxtLink
          v-else
          :to="featuredHref"
          class="mt-5 block rounded-2xl bg-black/20 p-5 ring-1 ring-white/10 transition-all hover:bg-black/30 hover:shadow-[0_0_24px_rgba(76,215,246,0.10)]"
        >
          <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">{{ featured.week_label }}</div>
          <div class="mt-2 text-balance font-headline text-lg font-bold text-tn-on-surface">
            Roundup {{ featured.week_label }}
          </div>
          <p v-if="featuredExcerpt" class="mt-2 text-sm leading-relaxed text-tn-on-surface-variant">{{ featuredExcerpt }}</p>
        </NuxtLink>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Security Briefings for CISOs & Leaders | ThreatNoir',
  description:
    'Weekly security briefings for CISOs and security leaders. Curated intelligence, executive context, and decision-ready signal across breaches, vulnerabilities, and regulations.',
  ogTitle: 'Security Briefings for CISOs & Leaders | ThreatNoir',
  ogDescription:
    'Weekly security briefings for CISOs and security leaders. Curated intelligence, executive context, and decision-ready signal across breaches, vulnerabilities, and regulations.',
  ogType: 'website'
})

const cards = [
  {
    title: 'Weekly Roundup',
    desc: 'A practitioner-grade digest you can forward internally.',
    href: '/weekly',
    icon: 'i-heroicons-document-text'
  },
  {
    title: 'Briefs',
    desc: 'Top stories distilled into fast, high-signal reads.',
    href: '/briefs',
    icon: 'i-heroicons-newspaper'
  },
  {
    title: 'Awareness Lessons',
    desc: 'Shareable takeaways from real incidents for your team.',
    href: '/awareness',
    icon: 'i-heroicons-light-bulb'
  },
  {
    title: 'Events',
    desc: 'Conferences and security events worth tracking.',
    href: '/events',
    icon: 'i-heroicons-calendar-days'
  }
]

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

const { data, pending } = await useFetch<WeeklyResponse>('/api/weekly', {
  query: { limit: 1 }
})

const featured = computed(() => (Array.isArray(data.value?.items) ? (data.value!.items[0] ?? null) : null))
const featuredHref = computed(() => (featured.value?.slug ? `/weekly/${featured.value.slug}` : '/weekly'))
const featuredExcerpt = computed(() => {
  const raw = (featured.value?.tldr || '').trim()
  if (!raw) return ''
  const oneLine = raw.replace(/^\s*[-*+]\s+/gm, '').replace(/\s+/g, ' ').trim()
  if (!oneLine) return ''
  return oneLine.length <= 180 ? oneLine : oneLine.slice(0, 180).trim() + '...'
})
</script>
