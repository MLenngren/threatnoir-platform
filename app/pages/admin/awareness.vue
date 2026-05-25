<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
	        <h1 class="text-2xl font-semibold tracking-tight">Awareness Lessons</h1>
        <p class="mt-1 text-sm text-gray-300">Review, edit, and publish lessons generated from approved articles.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <USelect v-model="filters.status" :items="statusOptions" size="sm" class="min-w-40" />
        <UButton size="sm" @click="openAdd">Add lesson</UButton>
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
      </div>
    </div>

    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-gray-300">
          Showing <span class="font-medium text-gray-100">{{ data?.items?.length ?? 0 }}</span> of
          <span class="font-medium text-gray-100">{{ data?.total ?? 0 }}</span>
        </div>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">Title</th>
              <th class="px-2 py-2">Tags</th>
              <th class="px-2 py-2">Status</th>
              <th class="px-2 py-2">Published</th>
              <th class="px-2 py-2">Article</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="l in data?.items ?? []"
              :key="l.id"
              class="cursor-pointer border-b border-gray-900 hover:bg-gray-900/30"
              @click="openEdit(l)"
            >
              <td class="max-w-[420px] px-2 py-2">
                <div class="truncate font-medium text-gray-100">{{ l.title }}</div>
                <div class="truncate text-xs text-gray-400">{{ l.id }}</div>
              </td>
              <td class="px-2 py-2">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="t in l.tags"
                    :key="t.id"
                    class="rounded-full border border-gray-800 bg-gray-950 px-2 py-0.5 text-[10px] font-medium text-gray-400"
                  >
                    {{ t.name }}
                  </span>
                  <span v-if="!l.tags?.length" class="text-xs text-gray-600">—</span>
                </div>
              </td>
              <td class="px-2 py-2">
                <span class="rounded border border-gray-800 px-2 py-0.5 text-xs" :class="statusClass(l.status)">
                  {{ l.status }}
                </span>
              </td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(l.published_at) }}</td>
              <td class="max-w-[320px] px-2 py-2">
                <a
                  v-if="l.article?.url"
                  :href="safeHref(l.article.url)"
                  target="_blank"
                  class="block truncate text-gray-200 hover:underline"
                  @click.stop
                >
                  {{ l.article.title || l.article.url }}
                </a>
                <span v-else class="text-xs text-gray-600">—</span>
              </td>
              <td class="px-2 py-2" @click.stop>
                <div class="flex gap-2">
                  <UButton size="xs" color="gray" variant="soft" @click="openEdit(l)">Edit</UButton>
                  <UButton
                    v-if="l.status === 'draft'"
                    size="xs"
                    color="success"
                    variant="outline"
                    :loading="actionLoadingId === l.id"
                    @click="setStatus(l.id, 'published')"
                  >
                    Publish
                  </UButton>
                  <UButton
                    v-else
                    size="xs"
                    color="warning"
                    variant="outline"
                    :loading="actionLoadingId === l.id"
                    @click="setStatus(l.id, 'draft')"
                  >
                    Unpublish
                  </UButton>
                </div>
              </td>
            </tr>

            <tr v-if="!pending && (data?.items?.length ?? 0) === 0">
              <td colspan="6" class="px-2 py-6 text-center text-sm text-gray-400">No lessons found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal
      v-model:open="editOpen"
      :title="editMode === 'add' ? 'Add lesson' : 'Edit lesson'"
      :description="editMode === 'add' ? 'Create a new lesson.' : 'Update lesson content, tags, and status.'"
    >
      <template #content>
        <div class="space-y-5">
          <UFormGroup label="Title" required>
            <UInput v-model="form.title" placeholder="Short lesson headline" />
          </UFormGroup>

          <UFormGroup label="Body" required>
            <UTextarea v-model="form.body" :rows="6" placeholder="3–5 sentences explaining what went wrong and why it matters." />
          </UFormGroup>

          <UFormGroup label="Prevention">
            <UTextarea v-model="form.prevention" :rows="4" placeholder="What could have prevented this." />
          </UFormGroup>

          <UFormGroup label="Framework refs">
            <UTextarea
              v-model="form.framework_refs_text"
              :rows="3"
              placeholder="One per line (e.g., CIS Control 6, NIST AC-2)"
            />
          </UFormGroup>

          <UFormGroup label="Article id (optional)">
            <UInput v-model="form.article_id" placeholder="UUID of the source article" />
          </UFormGroup>

          <div>
            <div class="mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">Tags</div>
            <div v-if="tags.length" class="flex flex-wrap gap-2">
              <button
                v-for="t in tags"
                :key="t.id"
                type="button"
                class="rounded-full border px-2 py-1 text-[11px] font-semibold"
                :class="form.tag_ids.includes(t.id)
                  ? 'border-indigo-700 bg-indigo-950/40 text-indigo-200'
                  : 'border-gray-800 bg-gray-950 text-gray-400 hover:bg-gray-900/30'"
                @click="toggleTag(t.id)"
              >
                {{ t.name }}
              </button>
            </div>
            <div v-else class="text-sm text-gray-500">No tags available.</div>
          </div>

          <UFormGroup label="Status">
            <USelect v-model="form.status" :items="lessonStatusOptions" size="sm" />
          </UFormGroup>

          <UAlert v-if="formError" color="red" variant="soft" title="Could not save">
            {{ formError }}
          </UAlert>

          <div class="flex items-center justify-end gap-2 border-t border-gray-800 pt-4">
            <UButton color="gray" variant="soft" :disabled="saving" @click="editOpen = false">Cancel</UButton>
            <UButton :loading="saving" @click="save">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

definePageMeta({ layout: 'admin' })

type AwarenessTagRow = {
  id: string
  name: string
  slug: string
  color: string | null
  lesson_count: number
}

type LessonTag = { id: string; name: string; slug: string; color: string | null }

type LessonRow = {
  id: string
  article_id: string | null
  title: string
  body: string
  prevention: string | null
  framework_refs: string[] | null
  status: 'draft' | 'published'
  created_at: string
  published_at: string | null
  article?: { id: string; title: string; url: string } | null
  tags: LessonTag[]
}

type LessonsResponse = {
  page: number
  pageSize: number
  total: number
  items: LessonRow[]
}

const route = useRoute()

const filters = reactive({
  status: (route.query.status as string) || 'all'
})

const query = computed(() => {
  return {
    status: filters.status,
    page: 1,
    pageSize: 50
  }
})

const { data, pending, refresh } = await useFetch<LessonsResponse>('/api/admin/awareness', { query, watch: [query] })

const { data: tagsData } = await useFetch<{ items: AwarenessTagRow[] }>('/api/awareness/tags')
const tags = computed(() => tagsData.value?.items ?? [])

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' }
]

const lessonStatusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' }
]

const editOpen = ref(false)
const editMode = ref<'add' | 'edit'>('add')
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)

const actionLoadingId = ref<string | null>(null)

const form = reactive<{
  title: string
  body: string
  prevention: string
  framework_refs_text: string
  article_id: string
  tag_ids: string[]
  status: 'draft' | 'published'
}>({
  title: '',
  body: '',
  prevention: '',
  framework_refs_text: '',
  article_id: '',
  tag_ids: [],
  status: 'draft'
})

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

function statusClass(status: LessonRow['status']) {
  if (status === 'published') return 'border-green-900/60 bg-green-900/20 text-green-200'
  return 'border-yellow-900/60 bg-yellow-900/20 text-yellow-200'
}

function toggleTag(tagId: string) {
  const i = form.tag_ids.indexOf(tagId)
  if (i >= 0) {
    form.tag_ids = [...form.tag_ids.slice(0, i), ...form.tag_ids.slice(i + 1)]
    return
  }
  form.tag_ids = [...form.tag_ids, tagId]
}

function openAdd() {
  editMode.value = 'add'
  editingId.value = null
  form.title = ''
  form.body = ''
  form.prevention = ''
  form.framework_refs_text = ''
  form.article_id = ''
  form.tag_ids = []
  form.status = 'draft'
  formError.value = null
  editOpen.value = true
}

function openEdit(l: LessonRow) {
  editMode.value = 'edit'
  editingId.value = l.id
  form.title = l.title
  form.body = l.body
  form.prevention = l.prevention ?? ''
  form.framework_refs_text = (l.framework_refs ?? []).join('\n')
  form.article_id = l.article_id ?? ''
  form.tag_ids = (l.tags ?? []).map((t) => t.id)
  form.status = l.status
  formError.value = null
  editOpen.value = true
}

async function setStatus(id: string, status: LessonRow['status']) {
  actionLoadingId.value = id
  try {
    await $fetch(`/api/admin/awareness/${id}`, {
      method: 'PATCH',
      body: { status }
    })
    await refresh()
  } finally {
    actionLoadingId.value = null
  }
}

async function save() {
  saving.value = true
  formError.value = null
  try {
    const framework_refs = form.framework_refs_text
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20)

    const payload = {
      id: editMode.value === 'edit' ? editingId.value : undefined,
      title: form.title,
      body: form.body,
      prevention: form.prevention.trim() ? form.prevention : null,
      framework_refs,
      article_id: form.article_id.trim() ? form.article_id.trim() : null,
      tag_ids: form.tag_ids,
      status: form.status
    }

    await $fetch('/api/admin/awareness', {
      method: 'POST',
      body: payload
    })

    editOpen.value = false
    await refresh()
  } catch (e) {
    formError.value = getErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>
