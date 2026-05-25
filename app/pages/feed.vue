<template>
	  <main class="grid-bg py-10">
	    <div class="mx-auto max-w-6xl px-6">
	      <section class="glass-panel rounded-2xl p-6 md:p-8">
	        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
	          <div>
	            <div class="flex items-center gap-3">
	              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Intel feed archive</span>
	            </div>
	            <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">
	              Intel Feed Archive
	            </h1>
	            <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	              Latest approved security headlines—fast, clean, and source-referenced.
	            </p>
	          </div>

	          <div class="flex items-center gap-6">
	            <div class="text-right">
	              <div class="font-headline text-2xl font-black text-tn-on-surface">{{ articles.length }}</div>
	              <div class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">Loaded</div>
	            </div>
	          </div>
	        </div>

	        <div class="mt-6 grid gap-3 md:grid-cols-12">
	          <div class="md:col-span-8">
	            <SearchBar v-model="search" />
	          </div>
	          <div class="md:col-span-4">
	            <label class="sr-only" for="feed-category">Category</label>
	            <USelect
	              id="feed-category"
	              v-model="category"
	              :items="categoryOptions"
	              size="md"
	              class="w-full"
	            />
	          </div>
	        </div>
	      </section>

	      <section class="mt-10">
	        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
	          <ArticleCard v-for="article in articles" :key="article.id" :article="article" />
	        </div>

	        <div class="mt-10 flex items-center justify-center">
	          <button
	            v-if="hasMore"
	            type="button"
	            class="rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:opacity-60"
	            :disabled="loadingMore"
	            @click="loadMore"
	          >
	            {{ loadingMore ? 'Loading…' : 'Load more' }}
	          </button>
	        </div>
	      </section>
	    </div>
	  </main>
</template>

<script setup lang="ts">
import ArticleCard from '~/components/ArticleCard.vue'
import SearchBar from '~/components/SearchBar.vue'
import { useArticles } from '~/composables/useArticles'

type CategoryOption = { label: string; value: string | null }

useSeoMeta({
  title: 'Intel Feed Archive — ThreatNoir',
  description: 'Latest approved security news—fast, clean, and source-referenced.',
  ogTitle: 'Intel Feed Archive — ThreatNoir',
  ogDescription: 'Latest approved security news—fast, clean, and source-referenced.',
  ogType: 'website'
})

const search = ref('')
const category = ref<string | null>(null)

const { data: categoriesData } = await useFetch<{
  items: Array<{ id: string; name: string; slug: string }>
}>('/api/categories')

const categories = computed(() => categoriesData.value?.items ?? [])
const categoryOptions = computed<CategoryOption[]>(() => {
  return [{ label: 'All categories', value: null }, ...categories.value.map((c) => ({ label: c.name, value: c.slug }))]
})

const { articles, hasMore, loadMore, loadingMore } = useArticles({
  search,
  category
})
</script>
