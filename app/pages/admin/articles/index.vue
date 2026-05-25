<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Articles</h1>
        <p class="mt-1 text-sm text-gray-300">Approve or reject articles for the public site.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="filters.status"
          :items="statusOptions"
          size="sm"
          class="min-w-40"
        />
        <USelect
          v-model="filters.categoryId"
          :items="categoryOptions"
          size="sm"
          class="min-w-44"
        />
        <USelect
          v-model="filters.sourceId"
          :items="sourceOptions"
          size="sm"
          class="min-w-44"
        />
      </div>
    </div>

    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-gray-300">
          Showing <span class="font-medium text-gray-100">{{ data?.articles?.length ?? 0 }}</span> of
          <span class="font-medium text-gray-100">{{ data?.total ?? 0 }}</span>
        </div>

        <div class="flex items-center gap-2">
          <USelect v-model="filters.sort" :items="sortOptions" size="sm" class="min-w-40" />
          <USelect v-model="filters.order" :items="orderOptions" size="sm" class="min-w-28" />
          <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
        </div>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">Title</th>
              <th class="px-2 py-2">Source</th>
              <th class="px-2 py-2">Category</th>
              <th class="px-2 py-2">Status</th>
	              <th class="px-2 py-2">Relevance</th>
              <th class="px-2 py-2">Published</th>
	              <th class="px-2 py-2">Ratings</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in data?.articles ?? []"
              :key="a.id"
              class="cursor-pointer border-b border-gray-900 hover:bg-gray-900/30"
              @click="goToArticle(a.id)"
            >
              <td class="max-w-[420px] px-2 py-2">
                <div class="truncate font-medium text-gray-100">{{ a.title }}</div>
                <div class="truncate text-xs text-gray-400">{{ a.url }}</div>
              </td>
              <td class="px-2 py-2 text-gray-200">{{ a.source?.name ?? '—' }}</td>
	              <td class="px-2 py-2 text-gray-200">
	                <div>{{ a.category?.name ?? '—' }}</div>
	                <div v-if="extraTags(a).length" class="mt-1 flex flex-wrap gap-1">
	                  <span
	                    v-for="t in extraTags(a)"
	                    :key="t.slug"
	                    class="rounded-full border border-gray-800 bg-gray-950 px-2 py-0.5 text-[10px] font-medium text-gray-400"
	                  >
	                    {{ t.name }}
	                  </span>
	                </div>
	              </td>
              <td class="px-2 py-2">
                <span class="rounded border border-gray-800 px-2 py-0.5 text-xs" :class="statusClass(a.status)">
                  {{ a.status }}
                </span>
              </td>
	              <td class="px-2 py-2">
	                <span
	                  class="rounded border border-gray-800 px-2 py-0.5 text-xs"
	                  :class="relevanceClass(a.relevance_score)"
	                >
	                  {{ fmtRelevance(a.relevance_score) }}
	                </span>
	              </td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(a.published_at) }}</td>
	              <td class="px-2 py-2 text-gray-300">{{ fmtRating(a.avg_score, a.score_count) }}</td>
              <td class="px-2 py-2" @click.stop>
                <div class="flex gap-2">
                  <UButton
                    size="xs"
                    color="success"
                    variant="outline"
                    class="cursor-pointer transition-colors"
                    :loading="actionLoadingId === a.id && actionType === 'approve'"
                    @click="setStatus(a.id, 'approved')"
                  >
                    Approve
                  </UButton>
                  <UButton
                    size="xs"
                    color="warning"
                    variant="outline"
                    class="cursor-pointer transition-colors"
                    :loading="actionLoadingId === a.id && actionType === 'reject'"
                    @click="setStatus(a.id, 'rejected')"
                  >
                    Reject
                  </UButton>
                  <UButton
                    size="xs"
                    color="error"
                    variant="outline"
                    class="cursor-pointer transition-colors"
                    :loading="actionLoadingId === a.id && actionType === 'delete'"
                    @click="deleteArticle(a.id)"
                  >
                    Delete
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type Category = { id: string; name: string; slug: string }
type Source = { id: string; name: string; is_active: boolean; type: string }
	type ArticleRow = {
  id: string
  title: string
  url: string
  status: 'pending' | 'approved' | 'rejected'
	  relevance_score: number | null
	  avg_score: number | string | null
	  score_count: number
  published_at: string | null
  ingested_at: string
  source?: { id: string; name: string } | null
  category?: { id: string; name: string; slug: string } | null
	  tags?: Category[]
}
type ArticlesResponse = {
  page: number
  pageSize: number
  total: number
  articles: ArticleRow[]
  categories: Category[]
  sources: Source[]
}

const route = useRoute()

const filters = reactive({
  status: (route.query.status as string) || 'pending',
  categoryId: (route.query.categoryId as string) || 'all',
  sourceId: (route.query.sourceId as string) || 'all',
  sort: (route.query.sort as string) || 'ingested_at',
  order: (route.query.order as string) || 'desc'
})

const query = computed(() => {
  return {
    status: filters.status === 'all' ? undefined : filters.status,
    categoryId: filters.categoryId === 'all' ? undefined : filters.categoryId,
    sourceId: filters.sourceId === 'all' ? undefined : filters.sourceId,
    sort: filters.sort,
    order: filters.order,
    page: 1,
    pageSize: 50
  }
})

const { data, pending, refresh } = await useFetch<ArticlesResponse>('/api/admin/articles', { query, watch: [query] })

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' }
]

const sortOptions = [
  { label: 'Ingested at', value: 'ingested_at' },
  { label: 'Published at', value: 'published_at' }
]

const orderOptions = [
  { label: 'Desc', value: 'desc' },
  { label: 'Asc', value: 'asc' }
]

const categoryOptions = computed(() => {
  const cats = data.value?.categories ?? []
  return [{ label: 'All categories', value: 'all' }, ...cats.map((c) => ({ label: c.name, value: c.id }))]
})

const sourceOptions = computed(() => {
  const sources = data.value?.sources ?? []
  return [{ label: 'All sources', value: 'all' }, ...sources.map((s) => ({ label: s.name, value: s.id }))]
})

const actionLoadingId = ref<string | null>(null)
const actionType = ref<'approve' | 'reject' | 'delete' | null>(null)

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

	function fmtRating(avgScore: number | string | null, count: number) {
	  if (!count) return 'Not rated'
	  const n = typeof avgScore === 'number' ? avgScore : Number.parseFloat(String(avgScore))
	  const avg = Number.isFinite(n) ? n.toFixed(1) : '—'
	  return `${avg}/10 (${count} ${count === 1 ? 'rating' : 'ratings'})`
	}

function statusClass(status: string) {
  if (status === 'approved') return 'border-green-900/60 bg-green-900/20 text-green-200'
  if (status === 'rejected') return 'border-red-900/60 bg-red-900/20 text-red-200'
  return 'border-yellow-900/60 bg-yellow-900/20 text-yellow-200'
}

	function fmtRelevance(score: number | null) {
	  if (typeof score !== 'number' || !Number.isFinite(score)) return '—'
	  return String(score)
	}

	function relevanceClass(score: number | null) {
	  if (typeof score !== 'number' || !Number.isFinite(score)) return 'border-gray-800 bg-gray-950 text-gray-400'
	  if (score >= 8) return 'border-green-900/60 bg-green-900/20 text-green-200'
	  if (score >= 5) return 'border-yellow-900/60 bg-yellow-900/20 text-yellow-200'
	  return 'border-red-900/60 bg-red-900/20 text-red-200'
	}

	function extraTags(a: ArticleRow) {
	  const primary = a.category?.slug
	  const tags = a.tags ?? []
	  return tags.filter((t) => t && t.slug && t.slug !== primary)
	}

function goToArticle(id: string) {
  navigateTo(`/admin/articles/${id}`)
}

async function setStatus(id: string, status: 'approved' | 'rejected') {
  actionLoadingId.value = id
  actionType.value = status === 'approved' ? 'approve' : 'reject'
  try {
    await $fetch(`/api/admin/articles/${id}`, {
      method: 'PATCH',
      body: { status }
    })
    await refresh()
  } finally {
    actionLoadingId.value = null
    actionType.value = null
  }
}

async function deleteArticle(id: string) {
  if (!confirm('Delete this article? This cannot be undone.')) return

  actionLoadingId.value = id
  actionType.value = 'delete'
  try {
    await $fetch(`/api/admin/articles/${id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    actionLoadingId.value = null
    actionType.value = null
  }
}
</script>
