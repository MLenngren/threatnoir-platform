import type { Ref } from 'vue'

import type { PublicArticle } from '~/types/public'

type UseArticlesArgs = {
  category?: Ref<string> | Ref<string | null> | Ref<undefined>
  search?: Ref<string>
  pageSize?: number
}

type ArticlesResponse = {
  items: PublicArticle[]
  nextOffset: number
  hasMore: boolean
}

export function useArticles(args: UseArticlesArgs = {}) {
  const category = args.category
  const search = args.search ?? ref('')
  const pageSize = args.pageSize ?? 20

  const nextOffset = ref(0)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  const articles = ref<PublicArticle[]>([])

  const baseQuery = computed(() => {
    const q: Record<string, string | number | undefined> = {
      limit: pageSize,
      offset: 0
    }

    const categoryValue = category ? (category.value as string | null | undefined) : null
    if (categoryValue) q.category = categoryValue

    if (search.value.trim()) q.q = search.value.trim()
    return q
  })

  const { data } = useFetch<ArticlesResponse>('/api/articles', {
    query: baseQuery
  })

  watch(
    data,
    (res) => {
      if (!res) return
      articles.value = res.items ?? []
      nextOffset.value = res.nextOffset ?? 0
      hasMore.value = !!res.hasMore
    },
    { immediate: true }
  )

  async function loadMore() {
    if (!hasMore.value || loadingMore.value) return

    loadingMore.value = true
    try {
      const res = await $fetch<ArticlesResponse>('/api/articles', {
        query: {
          ...baseQuery.value,
          offset: nextOffset.value
        }
      })

      articles.value = [...articles.value, ...(res.items ?? [])]
      nextOffset.value = res.nextOffset ?? nextOffset.value
      hasMore.value = !!res.hasMore
    } finally {
      loadingMore.value = false
    }
  }

  return {
    articles,
    hasMore,
    loadMore,
    loadingMore
  }
}
