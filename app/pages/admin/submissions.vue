<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Submissions</h1>
        <p class="mt-1 text-sm text-gray-300">Review community submissions.</p>
      </div>

      <div class="flex items-center gap-2">
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
      </div>
    </div>

    <UCard>
      <div class="text-sm text-gray-300">
        Pending: <span class="font-medium text-gray-100">{{ data?.total ?? 0 }}</span>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">URL</th>
              <th class="px-2 py-2">Suggested title</th>
              <th class="px-2 py-2">Submitter</th>
              <th class="px-2 py-2">Submitted</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in data?.submissions ?? []" :key="s.id" class="border-b border-gray-900">
	              <td class="max-w-[380px] px-2 py-2">
	                <a :href="safeHref(s.url)" target="_blank" class="truncate text-gray-100 hover:underline">{{ s.url }}</a>
	              </td>
              <td class="max-w-[420px] px-2 py-2 text-gray-200">
                <div class="truncate">{{ s.suggested_title ?? '—' }}</div>
              </td>
              <td class="px-2 py-2 text-gray-200">{{ s.submitter_name ?? '—' }}</td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(s.created_at) }}</td>
              <td class="px-2 py-2">
                <div class="flex gap-2">
                  <UButton
                    size="xs"
                    color="green"
                    variant="soft"
                    :loading="actionId === s.id && actionType === 'approve'"
                    @click="act(s.id, 'approve')"
                  >
                    Approve
                  </UButton>
                  <UButton
                    size="xs"
                    color="red"
                    variant="soft"
                    :loading="actionId === s.id && actionType === 'reject'"
                    @click="act(s.id, 'reject')"
                  >
                    Reject
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
import { safeHref } from '~/composables/useSafeHref'

definePageMeta({ layout: 'admin' })

type SubmissionRow = {
  id: string
  url: string
  suggested_title: string | null
  status: 'pending' | 'approved' | 'rejected'
  submitter_name: string | null
  created_at: string
}

type SubmissionsResponse = {
  page: number
  pageSize: number
  total: number
  submissions: SubmissionRow[]
}

type SubmissionActionResponse = { ok: boolean; articleId?: string }

const { data, pending, refresh } = await useFetch<SubmissionsResponse>('/api/admin/submissions', {
  query: { status: 'pending', page: 1, pageSize: 100 }
})

const actionId = ref<string | null>(null)
const actionType = ref<'approve' | 'reject' | null>(null)

function fmtDate(d: string) {
  return new Date(d).toLocaleString()
}

async function act(id: string, action: 'approve' | 'reject') {
  actionId.value = id
  actionType.value = action
  try {
    const res = await $fetch<SubmissionActionResponse>(`/api/admin/submissions/${id}`, {
      method: 'PATCH',
      body: { action }
    })
    await refresh()
    if (action === 'approve' && res?.articleId) {
      await navigateTo(`/admin/articles/${res.articleId}`)
    }
  } finally {
    actionId.value = null
    actionType.value = null
  }
}
</script>
