<template>
  <main class="pt-4 pb-12 px-8 min-h-screen">
    <div class="max-w-screen-xl mx-auto">
      <!-- Hero Header -->
      <header class="mb-12 relative overflow-hidden p-12 rounded-2xl glass-panel">
        <div
          class="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800')] bg-cover mix-blend-overlay"
        />
        <div class="relative z-10 max-w-2xl">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-label font-bold tracking-widest uppercase mb-6"
          >
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Knowledge Repository
          </div>

          <h1 class="text-5xl lg:text-6xl font-black font-headline tracking-tighter text-on-surface mb-4 leading-tight">
            Tactical Tips <br><span class="text-primary">Repository.</span>
          </h1>

          <p class="text-on-surface-variant text-lg leading-relaxed max-w-lg mb-8">
            High-density tactical advice for security engineers. Curated prompts, compliance checklists, and operational maneuvers.
          </p>

          <div class="flex gap-4">
            <div
              class="px-6 py-2 bg-surface-container-low rounded-lg border border-outline-variant/10 font-label text-sm text-on-surface"
            >
              <span class="text-primary font-bold">{{ tips.length }}</span> Tips Loaded
            </div>
            <div
              class="px-6 py-2 bg-surface-container-low rounded-lg border border-outline-variant/10 font-label text-sm text-on-surface"
            >
              <span class="text-primary font-bold">{{ categories.length }}</span> Categories
            </div>
          </div>
        </div>
      </header>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-4 mb-10">
        <NuxtLink
          to="/tips"
          class="px-5 py-2 rounded-full font-label text-xs tracking-wider uppercase"
          :class="!selectedCategory ? 'bg-primary text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all'"
        >
          All Intel
        </NuxtLink>
        <NuxtLink
          v-for="cat in categories"
          :key="cat.id"
          :to="{ path: '/tips', query: { category: cat.slug } }"
          class="px-5 py-2 rounded-full font-label text-xs tracking-wider uppercase"
          :class="selectedCategory === cat.slug
            ? 'bg-primary text-on-primary font-bold'
            : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all'"
        >
          {{ cat.name }}
        </NuxtLink>

        <div class="ml-auto flex items-center gap-2 text-on-surface-variant font-label text-xs uppercase tracking-widest opacity-60">
          Sort By: <span class="text-primary cursor-pointer hover:underline">Newest First</span>
        </div>
      </div>

      <div v-if="pending" class="p-8 rounded-xl bg-surface-container-low border border-outline-variant/5 text-sm text-on-surface-variant">
        Loading tips…
      </div>

      <!-- Bento Grid Intelligence Cards -->
      <div v-else class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <TipCard v-if="bento.featured" :tip="bento.featured" class="md:col-span-8" />
        <TipCard v-if="bento.regulation" :tip="bento.regulation" class="md:col-span-4" />
        <TipCard v-if="bento.ops" :tip="bento.ops" class="md:col-span-4" />
        <TipCard v-if="bento.ai" :tip="bento.ai" class="md:col-span-4" />

        <!-- Card: Data Grid (Small/Status) -->
        <div class="md:col-span-4 p-8 rounded-xl glass-panel flex flex-col justify-center border-primary/20 bg-primary/5">
          <div class="text-center">
            <div class="text-4xl font-black text-primary mb-2">98.4%</div>
            <div class="text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-6">Pipeline Accuracy</div>
            <div class="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden mb-8">
              <div class="h-full bg-primary w-[98.4%]" />
            </div>
            <p class="text-xs text-on-surface-variant italic">
              "Live updates from the tactical repository stream. All prompts validated by core ops."
            </p>
          </div>
        </div>

        <TipCard
          v-for="tip in bento.rest"
          :key="tip.id"
          :tip="tip"
          :class="tip.featured ? 'md:col-span-8' : 'md:col-span-4'"
        />

        <div v-if="!visibleTips.length" class="md:col-span-12 p-8 rounded-xl bg-surface-container-low border border-outline-variant/5 text-sm text-on-surface-variant">
          No tips found.
        </div>
      </div>

      <!-- Load More / Section Footer -->
      <div class="mt-16 flex flex-col items-center">
        <div class="w-full h-px bg-gradient-to-r from-transparent via-outline-variant/20 to-transparent mb-12" />
        <button
          type="button"
          class="group flex flex-col items-center gap-4 text-on-surface-variant hover:text-primary transition-all disabled:opacity-40"
          :disabled="!hasMore"
          @click="hasMore && loadMore()"
        >
          <span class="text-xs font-label uppercase tracking-widest font-bold">Access Deep Repository</span>
          <UIcon name="i-heroicons-chevron-double-down" class="h-10 w-10 group-hover:translate-y-2 transition-transform" />
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

import TipCard from '~/components/TipCard.vue'
import type { TipItem } from '~/components/TipCard.vue'

type TipCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number | null
}

type CategoriesResponse = {
  items: TipCategory[]
}

type TipsResponse = {
  items: TipItem[]
}

useSeoMeta({
  title: 'Security Tips & Tricks — ThreatNoir',
  description: 'High-density security tips for practitioners: prompts, compliance shortcuts, and operational tactics.',
  ogTitle: 'Security Tips & Tricks — ThreatNoir',
  ogDescription: 'High-density security tips for practitioners: prompts, compliance shortcuts, and operational tactics.',
  ogType: 'website'
})

const route = useRoute()

const selectedCategory = computed(() => (typeof route.query.category === 'string' ? route.query.category : ''))

const { data: categoriesData } = await useFetch<CategoriesResponse>('/api/tips/categories')
const categories = computed(() => categoriesData.value?.items ?? [])

const search = ref('')
const debouncedSearch = ref('')
const syncDebounced = useDebounceFn(() => {
  debouncedSearch.value = search.value.trim()
}, 250)

watch(search, () => syncDebounced())

const apiQuery = computed(() => {
  const q: Record<string, string | number | undefined> = {}
  if (selectedCategory.value) q.category = selectedCategory.value
  if (debouncedSearch.value) q.search = debouncedSearch.value
  return q
})

const { data, pending } = await useFetch<TipsResponse>('/api/tips', {
  query: apiQuery
})

const tips = computed(() => {
  const v = data.value?.items
  return Array.isArray(v) ? v : []
})

const visibleCount = ref(9)

watch(
  () => [selectedCategory.value, debouncedSearch.value],
  () => {
    visibleCount.value = 9
  }
)

const visibleTips = computed(() => tips.value.slice(0, visibleCount.value))
const hasMore = computed(() => tips.value.length > visibleCount.value)

const bento = computed(() => {
  const remaining = [...visibleTips.value]

  const take = (predicate: (tip: TipItem) => boolean): TipItem | null => {
    const idx = remaining.findIndex(predicate)
    if (idx === -1) return null
    const [picked] = remaining.splice(idx, 1)
    return picked ?? null
  }

  const featured =
    take((t) => Boolean(t.featured) && String(t.category?.color || '').toLowerCase() === 'cyan') ??
    take((t) => Boolean(t.featured)) ??
    take((t) => String(t.category?.color || '').toLowerCase() === 'cyan') ??
    take(() => true)
  const regulation = take((t) => String(t.category?.color || '').toLowerCase() === 'purple')
  const ops = take((t) => String(t.category?.color || '').toLowerCase() === 'orange')
  const ai = take((t) => String(t.category?.color || '').toLowerCase() === 'cyan')

  return {
    featured,
    regulation,
    ops,
    ai,
    rest: remaining
  }
})

function loadMore() {
  visibleCount.value = Math.min(tips.value.length, visibleCount.value + 6)
}
</script>
