<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <NuxtLink
        to="/feed"
        class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary"
      >
        <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
        Back to Feed
      </NuxtLink>

      <div v-if="pending" class="mt-8 rounded-xl bg-tn-surface-low/70 p-8 text-sm text-tn-on-surface-variant">
        Loading...
      </div>

      <template v-else>
        <header class="mt-6 glass-panel rounded-2xl p-6 md:p-8">
          <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Tag</p>
          <h1 class="mt-3 font-headline text-3xl font-black capitalize tracking-tight text-tn-on-surface md:text-4xl">
            {{ data?.tag?.name || slug }}
          </h1>
          <p v-if="data?.tag?.description" class="mt-3 text-sm text-tn-on-surface-variant">
            {{ data.tag.description }}
          </p>
          <p v-if="data" class="mt-2 text-xs text-tn-on-surface-variant">
            {{ data.total_count }} items tagged #{{ data.tag.slug }}
          </p>
        </header>

        <!-- Articles -->
        <section v-if="data?.articles?.length" class="mt-10">
          <h2 class="font-headline text-xl font-bold text-tn-on-surface">Articles</h2>
          <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <a
              v-for="a in data.articles"
              :key="a.id"
              :href="articleHref(a)"
              class="glass-panel rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div class="font-headline text-sm font-bold text-tn-on-surface">{{ a.title }}</div>
              <p v-if="a.brief" class="mt-2 text-xs text-tn-on-surface-variant line-clamp-2">{{ a.brief }}</p>
            </a>
          </div>
        </section>

        <!-- Awareness lessons -->
        <section v-if="data?.awareness?.length" class="mt-10">
          <h2 class="font-headline text-xl font-bold text-tn-on-surface">Awareness lessons</h2>
          <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <NuxtLink
              v-for="l in data.awareness"
              :key="l.id"
              :to="l.slug ? `/awareness/${l.slug}` : '/awareness'"
              class="glass-panel rounded-xl p-5 transition-all hover:-translate-y-0.5"
            >
              <div class="font-headline text-sm font-bold text-tn-on-surface">{{ l.title }}</div>
              <p v-if="l.summary" class="mt-2 text-xs text-tn-on-surface-variant line-clamp-2">{{ l.summary }}</p>
            </NuxtLink>
          </div>
        </section>

        <!-- Events -->
        <section v-if="data?.events?.length" class="mt-10">
          <h2 class="font-headline text-xl font-bold text-tn-on-surface">Events</h2>
          <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <a
              v-for="e in data.events"
              :key="e.id"
              :href="eventHref(e)"
              target="_blank"
              rel="noopener noreferrer"
              class="glass-panel rounded-xl p-5 transition-all hover:-translate-y-0.5"
            >
              <div class="font-headline text-sm font-bold text-tn-on-surface">{{ e.title }}</div>
              <p class="mt-1 text-xs text-tn-on-surface-variant">
                {{ e.start_date || 'TBA' }} · {{ e.location || (e.is_virtual ? 'Virtual' : '—') }}
              </p>
            </a>
          </div>
        </section>

        <!-- Focus items -->
        <section v-if="data?.focus_items?.length" class="mt-10">
          <h2 class="font-headline text-xl font-bold text-tn-on-surface">Focus items</h2>
          <div class="mt-4 grid grid-cols-1 gap-4">
            <div v-for="f in data.focus_items" :key="f.id" class="glass-panel rounded-xl p-5">
              <div class="flex items-center gap-2">
                <span class="font-label text-[10px] uppercase tracking-widest text-red-400">{{ f.severity }}</span>
                <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ f.category }}</span>
              </div>
              <div class="mt-2 font-headline text-sm font-bold text-tn-on-surface">{{ f.title }}</div>
              <p v-if="f.summary" class="mt-2 text-xs text-tn-on-surface-variant">{{ f.summary }}</p>
            </div>
          </div>
        </section>

        <!-- Tips -->
        <section v-if="data?.tips?.length" class="mt-10">
          <h2 class="font-headline text-xl font-bold text-tn-on-surface">Tips &amp; tricks</h2>
          <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <NuxtLink
              v-for="t in data.tips"
              :key="t.id"
              :to="`/tips/${t.id}`"
              class="glass-panel rounded-xl p-5 transition-all hover:-translate-y-0.5"
            >
              <div class="font-headline text-sm font-bold text-tn-on-surface">{{ t.title }}</div>
            </NuxtLink>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { createError } from 'h3'

type TagResponse = {
  tag: { slug: string; name: string; description: string | null }
  articles: Array<{ id: string; title: string; slug: string | null; brief: string | null; url: string }>
  awareness: Array<{ id: string; title: string; slug: string | null; summary: string | null }>
  events: Array<{
    id: string
    title: string
    slug: string | null
    url: string | null
    start_date: string | null
    location: string | null
    is_virtual?: boolean | null
  }>
  tips: Array<{ id: string; title: string }>
  focus_items: Array<{ id: string; title: string; summary: string | null; severity: string; category: string }>
  total_count: number
}

const route = useRoute()
const slug = computed(() => String(route.params.slug || '').trim().toLowerCase())

const { data, pending, error } = await useFetch<TagResponse>(() => `/api/tag/${encodeURIComponent(slug.value)}`, {
  key: () => `tag:${slug.value}`
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    statusMessage: error.value.statusMessage || 'Tag not found'
  })
}

	const site = useSiteConfig()
	const seoTitle = computed(() => (data.value ? `${data.value.tag.name} — Security Intel | ${site.name}` : `Tag | ${site.name}`))
const seoDescription = computed(() => {
	  if (!data.value) return `Browse security content by tag on ${site.name}.`
	  return `${data.value.total_count} items tagged ${data.value.tag.name} on ${site.name}.`.slice(0, 160)
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
	  ogImage: site.ogImageUrl,
	  ogUrl: computed(() => `${site.url}/tag/${slug.value}`),
  ogType: 'website',
  twitterCard: 'summary_large_image',
	  author: site.name
})

function articleHref(a: TagResponse['articles'][number]) {
  if (a.slug) return `/article/${encodeURIComponent(a.slug)}`
  return a.url
}

function eventHref(e: TagResponse['events'][number]) {
  if (e.url) return e.url
  return `https://www.google.com/search?q=${encodeURIComponent(e.title + ' conference')}`
}
</script>
