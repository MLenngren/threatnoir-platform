import type { Ref } from 'vue'

import type { AwarenessLesson, AwarenessTag } from '~/types/public'

type LessonsResponse = {
  items: AwarenessLesson[]
  page: number
  limit: number
  hasMore: boolean
}

type TagsResponse = {
  items: Array<AwarenessTag & { lesson_count: number }>
}

type UseAwarenessLessonsArgs = {
  tag?: Ref<string | null>
  pageSize?: number
}

export function useAwarenessLessons(args: UseAwarenessLessonsArgs = {}) {
  const tag = args.tag ?? ref<string | null>(null)
  const pageSize = args.pageSize ?? 12

  const nextPage = ref(1)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  const lessons = ref<AwarenessLesson[]>([])

  const baseQuery = computed(() => {
    const q: Record<string, string | number | undefined> = {
      limit: pageSize,
      page: 1
    }
    if (tag.value) q.tag = tag.value
    return q
  })

  const { data, pending } = useFetch<LessonsResponse>('/api/awareness', {
    query: baseQuery
  })

  watch(
    data,
    (res) => {
      if (!res) return
      lessons.value = res.items ?? []
      nextPage.value = (res.page ?? 1) + 1
      hasMore.value = !!res.hasMore
    },
    { immediate: true }
  )

  async function loadMore() {
    if (!hasMore.value || loadingMore.value) return

    loadingMore.value = true
    try {
      const res = await $fetch<LessonsResponse>('/api/awareness', {
        query: {
          ...baseQuery.value,
          page: nextPage.value
        }
      })

      lessons.value = [...lessons.value, ...(res.items ?? [])]
      nextPage.value = (res.page ?? nextPage.value) + 1
      hasMore.value = !!res.hasMore
    } finally {
      loadingMore.value = false
    }
  }

  return {
    lessons,
    pending,
    hasMore,
    loadMore,
    loadingMore
  }
}

export function useAwarenessTags() {
  return useFetch<TagsResponse>('/api/awareness/tags')
}
