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
              <UIcon name="i-heroicons-code-bracket" class="h-5 w-5 text-tn-primary" />
            </div>
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">For builders</div>
          </div>

          <h1 class="mt-4 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-5xl">
            APIs, MCP &amp; Threat Intel for <span class="text-tn-primary">Builders</span>
          </h1>
	          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-tn-on-surface-variant md:text-base">
	            Integrate IOCs and curated security signal into your tooling. Use the {{ site.name }} MCP server for AI workflows, or the REST API for automation.
          </p>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              to="/developer"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
            >
              Open Developer Portal →
            </NuxtLink>
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
            >
              View OpenAPI spec →
            </a>
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
            <p class="mt-1 text-sm text-tn-on-surface-variant">Latest approved article (great sample input for your pipelines).</p>
          </div>
          <NuxtLink
            to="/feed"
            class="rounded-lg bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
          >
            Browse feed →
          </NuxtLink>
        </div>

        <div v-if="pending" class="mt-5 text-sm text-tn-on-surface-variant">Loading…</div>
        <div v-else-if="!featured" class="mt-5 text-sm text-tn-on-surface-variant">No articles yet.</div>

        <NuxtLink
          v-else
          :to="featuredHref"
          class="mt-5 block rounded-2xl bg-black/20 p-5 ring-1 ring-white/10 transition-all hover:bg-black/30 hover:shadow-[0_0_24px_rgba(76,215,246,0.10)]"
        >
          <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Latest</div>
          <div class="mt-2 text-balance font-headline text-lg font-bold text-tn-on-surface">{{ featuredTitle }}</div>
          <p v-if="featuredExcerpt" class="mt-2 text-sm leading-relaxed text-tn-on-surface-variant">{{ featuredExcerpt }}</p>
        </NuxtLink>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
	const site = useSiteConfig()

useSeoMeta({
	  title: `APIs, MCP & Threat Intel for Builders | ${site.name}`,
  description:
	    `${site.name} for developers and platform engineers: IOC search API, MCP server for Claude and Cursor, RSS feeds, and automation-ready threat intelligence.`,
	  ogTitle: `APIs, MCP & Threat Intel for Builders | ${site.name}`,
  ogDescription:
	    `${site.name} for developers and platform engineers: IOC search API, MCP server for Claude and Cursor, RSS feeds, and automation-ready threat intelligence.`,
  ogType: 'website'
})

const cards = [
  {
    title: 'Developer portal',
    desc: 'MCP server + API key setup + copy/paste examples.',
    href: '/developer',
    icon: 'i-heroicons-command-line'
  },
  {
    title: 'IOC search',
    desc: 'Search and operationalize IOCs from approved sources.',
    href: '/iocs',
    icon: 'i-heroicons-magnifying-glass'
  },
  {
    title: 'Feed',
    desc: 'Curated articles to power enrichment and triage workflows.',
    href: '/feed',
    icon: 'i-heroicons-rss'
  },
  {
    title: 'Podcast',
    desc: 'Daily briefing as a fast “what changed?” input stream.',
    href: '/podcast',
    icon: 'i-heroicons-microphone'
  }
]

type ArticleItem = {
  title: string | null
  slug: string | null
  summary: string | null
  ai_summary: string | null
}

type ArticlesResponse = {
  items: ArticleItem[]
}

const { data, pending } = await useFetch<ArticlesResponse>('/api/articles', {
  query: { limit: 1 }
})

const featured = computed(() => (Array.isArray(data.value?.items) ? (data.value!.items[0] ?? null) : null))
const featuredHref = computed(() => (featured.value?.slug ? `/article/${featured.value.slug}` : '/feed'))
	const featuredTitle = computed(() => (featured.value?.title || '').trim() || `${site.name} article`)
const featuredExcerpt = computed(() => {
  const raw = (featured.value?.summary || featured.value?.ai_summary || '').trim()
  if (!raw) return ''
  const oneLine = raw.replace(/\s+/g, ' ').trim()
  return oneLine.length <= 200 ? oneLine : oneLine.slice(0, 200).trim() + '...'
})
</script>
