<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Sources</h1>
        <p class="mt-1 text-sm text-gray-300">Manage RSS sources used for ingestion.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton size="sm" @click="openAdd">Add source</UButton>
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
      </div>
    </div>

    <UCard>
      <div class="mt-1 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">Name</th>
              <th class="px-2 py-2">URL</th>
              <th class="px-2 py-2">Type</th>
              <th class="px-2 py-2">Active</th>
              <th class="px-2 py-2">Last fetched</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in sources"
              :key="s.id"
              class="cursor-pointer border-b border-gray-900 hover:bg-gray-900/30"
              @click="openEdit(s)"
            >
              <td class="px-2 py-2">
                <div class="font-medium text-gray-100">{{ s.name }}</div>
              </td>
	              <td class="max-w-[520px] px-2 py-2">
	                <a :href="safeHref(s.url)" target="_blank" class="truncate text-gray-200 hover:underline">{{ s.url }}</a>
	              </td>
              <td class="px-2 py-2 text-gray-300">{{ s.type }}</td>
              <td class="px-2 py-2" @click.stop>
                <UToggle
                  :model-value="s.is_active"
                  :disabled="toggleLoadingId === s.id"
                  @update:model-value="(v) => toggleActive(s, v)"
                />
              </td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(s.last_fetched_at) }}</td>
              <td class="px-2 py-2" @click.stop>
                <div class="flex gap-2">
                  <UButton size="xs" color="gray" variant="soft" @click="openEdit(s)">Edit</UButton>
                  <UButton
                    size="xs"
                    color="red"
                    variant="soft"
                    :loading="deleteLoadingId === s.id"
                    @click="openDelete(s)"
                  >
                    Delete
                  </UButton>
                </div>
              </td>
            </tr>
            <tr v-if="!pending && sources.length === 0">
              <td colspan="6" class="px-2 py-6 text-center text-sm text-gray-400">No sources found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal
      v-model:open="editOpen"
      :title="editMode === 'add' ? 'Add source' : 'Edit source'"
      :description="editMode === 'add' ? 'Create a new ingestion source.' : 'Update name and URL.'"
    >
      <template #content>
        <div class="space-y-4">
          <UFormGroup label="Name">
            <UInput v-model="form.name" placeholder="BleepingComputer" />
          </UFormGroup>

          <UFormGroup label="URL">
            <UInput v-model="form.url" placeholder="https://example.com/feed.xml" />
          </UFormGroup>

          <UFormGroup v-if="editMode === 'add'" label="Type">
            <USelect v-model="form.type" :options="typeOptions" />
          </UFormGroup>

          <UAlert v-if="formError" color="red" variant="soft" title="Could not save">
            {{ formError }}
          </UAlert>

          <div class="flex items-center justify-end gap-2">
            <UButton color="gray" variant="soft" :disabled="saving" @click="editOpen = false">Cancel</UButton>
            <UButton :loading="saving" @click="save">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Delete source" description="This cannot be undone.">
      <template #content>
        <div class="space-y-4">
          <div class="text-sm text-gray-300">
            Delete <span class="font-medium text-gray-100">{{ deleteTarget?.name }}</span>?
          </div>

          <UAlert v-if="deleteError" color="red" variant="soft" title="Could not delete">
            {{ deleteError }}
          </UAlert>

          <div class="flex items-center justify-end gap-2">
            <UButton color="gray" variant="soft" :disabled="deleting" @click="deleteOpen = false">Cancel</UButton>
            <UButton color="red" :loading="deleting" @click="confirmDelete">Delete</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

definePageMeta({ layout: 'admin' })

type SourceRow = {
  id: string
  name: string
  url: string
	  type: 'rss' | 'api' | 'community' | 'reddit'
  is_active: boolean
  last_fetched_at: string | null
}

type SourcesResponse = { sources: SourceRow[] }
type SourceResponse = { source: SourceRow }
type OkResponse = { ok: boolean }

const { data, pending, refresh } = await useFetch<SourcesResponse>('/api/admin/sources')

const sources = computed(() => data.value?.sources ?? [])

const typeOptions = [
  { label: 'RSS', value: 'rss' },
  { label: 'API', value: 'api' },
	{ label: 'Community', value: 'community' },
	{ label: 'Reddit', value: 'reddit' }
]

const editOpen = ref(false)
const editMode = ref<'add' | 'edit'>('add')
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)

	const form = reactive<{ name: string; url: string; type: 'rss' | 'api' | 'community' | 'reddit' }>({
  name: '',
  url: '',
  type: 'rss'
})

const toggleLoadingId = ref<string | null>(null)
const deleteLoadingId = ref<string | null>(null)

const deleteOpen = ref(false)
const deleteTarget = ref<SourceRow | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

function getErrorMessage(e: unknown) {
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const data = obj.data
    if (data && typeof data === 'object') {
      const statusMessage = (data as Record<string, unknown>).statusMessage
      if (typeof statusMessage === 'string' && statusMessage) return statusMessage
    }
    if (typeof obj.message === 'string' && obj.message) return obj.message
  }
  return 'Unknown error'
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function openAdd() {
  editMode.value = 'add'
  editingId.value = null
  form.name = ''
  form.url = ''
  form.type = 'rss'
  formError.value = null
  editOpen.value = true
}

function openEdit(s: SourceRow) {
  editMode.value = 'edit'
  editingId.value = s.id
  form.name = s.name
  form.url = s.url
  form.type = s.type
  formError.value = null
  editOpen.value = true
}

async function save() {
  saving.value = true
  formError.value = null
  try {
    if (editMode.value === 'add') {
      await $fetch<SourceResponse>('/api/admin/sources', {
        method: 'POST',
        body: { name: form.name, url: form.url, type: form.type }
      })
    } else {
      const id = editingId.value
      if (!id) throw new Error('Missing source id')
      await $fetch<SourceResponse>(`/api/admin/sources/${id}`, {
        method: 'PATCH',
        body: { name: form.name, url: form.url }
      })
    }
    editOpen.value = false
    await refresh()
  } catch (e) {
    formError.value = getErrorMessage(e)
  } finally {
    saving.value = false
  }
}

async function toggleActive(s: SourceRow, v: boolean) {
  toggleLoadingId.value = s.id
  try {
    await $fetch<SourceResponse>(`/api/admin/sources/${s.id}`, {
      method: 'PATCH',
      body: { is_active: v }
    })
    await refresh()
  } finally {
    toggleLoadingId.value = null
  }
}

function openDelete(s: SourceRow) {
  deleteTarget.value = s
  deleteError.value = null
  deleteOpen.value = true
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return

  deleting.value = true
  deleteLoadingId.value = target.id
  deleteError.value = null

  try {
    await $fetch<OkResponse>(`/api/admin/sources/${target.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    await refresh()
  } catch (e) {
    deleteError.value = getErrorMessage(e)
  } finally {
    deleting.value = false
    deleteLoadingId.value = null
  }
}
</script>
