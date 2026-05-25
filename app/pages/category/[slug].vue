<template>
	  <main class="grid-bg py-10">
	    <div class="mx-auto max-w-6xl px-6">
	      <section class="glass-panel rounded-2xl p-6 md:p-8">
	        <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
	          <div>
	            <div class="flex items-center gap-3">
	              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Category archive</span>
	            </div>
	            <h1 class="mt-3 text-balance font-headline text-4xl font-black tracking-tight text-tn-on-surface md:text-5xl">
	              {{ category?.name ?? 'Category' }}
	            </h1>
	            <p v-if="category?.description" class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	              {{ category.description }}
	            </p>
	          </div>

	          <div class="flex items-center gap-6">
	            <div class="text-right">
	              <div class="font-headline text-2xl font-black text-tn-on-surface">{{ articles.length }}</div>
	              <div class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">Loaded</div>
	            </div>
	          </div>
	        </div>

	        <div class="mt-6 grid gap-4">
	          <SearchBar v-model="search" />
	          <CategoryNav />
	        </div>
	      </section>

	      <section class="mt-10">
	        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

<script setup>
import ArticleCard from '~/components/ArticleCard.vue'
import CategoryNav from '~/components/CategoryNav.vue'
import SearchBar from '~/components/SearchBar.vue'
import { useArticles } from '~/composables/useArticles'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data: categoriesData } = await useFetch('/api/categories')
const category = computed(() => categoriesData.value?.items?.find((c) => c.slug === slug.value) ?? null)

if (import.meta.server && categoriesData.value && !category.value) {
  throw createError({ statusCode: 404, statusMessage: 'Category not found' })
}

useSeoMeta({
  title: () => `${category.value?.name ?? 'Category'} — ThreatNoir`,
  description: () =>
    category.value?.description ?? `Latest approved security news in ${category.value?.name ?? 'this category'}.`,
  ogTitle: () => `${category.value?.name ?? 'Category'} — ThreatNoir`,
  ogDescription: () =>
    category.value?.description ?? `Latest approved security news in ${category.value?.name ?? 'this category'}.`,
  ogType: 'website'
})

const search = ref('')
const { articles, hasMore, loadMore, loadingMore } = useArticles({
  category: slug,
  search
})
</script>
