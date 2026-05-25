<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Resources</h1>
        <p class="mt-1 text-sm text-gray-300">Curate posters, infographics, cheat sheets, and visual guides.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <USelect v-model="filters.status" :items="statusOptions" size="sm" class="min-w-40" />
        <UButton size="sm" @click="openAdd">Add resource</UButton>
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
      </div>
    </div>

    <UCard>
      <div class="mt-1 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">Title</th>
              <th class="px-2 py-2">Type</th>
              <th class="px-2 py-2">Category</th>
              <th class="px-2 py-2">Featured</th>
              <th class="px-2 py-2">Published</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in resources" :key="r.id" class="border-b border-gray-900">
              <td class="max-w-[520px] px-2 py-2">
                <div class="truncate font-medium text-gray-100">{{ r.title }}</div>
                <div class="truncate text-xs text-gray-500">{{ r.id }}</div>
              </td>
              <td class="px-2 py-2 text-gray-300">{{ typeLabel(r.content_type) }}</td>
              <td class="px-2 py-2 text-gray-300">{{ r.category || '—' }}</td>
              <td class="px-2 py-2" @click.stop>
                <UToggle
                  :model-value="Boolean(r.featured)"
                  :disabled="toggleLoadingId === r.id"
                  @update:model-value="(v) => toggleFeatured(r, v)"
                />
              </td>
              <td class="px-2 py-2" @click.stop>
                <UToggle
                  :model-value="r.status === 'published'"
                  :disabled="toggleLoadingId === r.id"
                  @update:model-value="(v) => togglePublished(r, v)"
                />
              </td>
              <td class="px-2 py-2" @click.stop>
                <div class="flex gap-2">
                  <UButton size="xs" color="gray" variant="soft" @click="openEdit(r)">Edit</UButton>
                  <UButton
                    size="xs"
                    color="red"
                    variant="soft"
                    :loading="deleteLoadingId === r.id"
                    @click="openDelete(r)"
                  >
                    Delete
                  </UButton>
                </div>
              </td>
            </tr>

            <tr v-if="!pending && resources.length === 0">
              <td colspan="6" class="px-2 py-8 text-center text-sm text-gray-400">No resources yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Tactical Upload Modal (Stitch design) -->
    <Teleport to="body">
      <div v-if="editOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @click.self="editOpen = false">
        <div class="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[rgba(8,14,26,0.95)] shadow-[0_20px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl" style="max-height: 90vh;">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-white/10 bg-gray-900/50 px-8 py-5">
            <div>
              <span class="font-label text-[10px] tracking-[0.3em] text-cyan-400/70">TACTICAL_ASSET_UPLOAD</span>
              <div class="mt-1 flex items-center gap-3">
                <h2 class="font-headline text-lg font-bold uppercase tracking-tight text-white">
                  {{ editMode === 'add' ? 'Resource Ingestion' : 'Update Resource' }}
                </h2>
                <span class="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-label text-[10px] font-black tracking-widest text-cyan-400">SECURE</span>
              </div>
            </div>
            <button class="text-gray-400 transition-colors hover:text-white" @click="editOpen = false">
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="flex-1 space-y-8 overflow-y-auto p-8">
            <!-- File Drop Zone -->
            <label class="group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 bg-gray-950/50 p-10 transition-all hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(76,215,246,0.1)]">
              <div class="absolute inset-0 rounded-lg bg-cyan-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
              <UIcon name="i-heroicons-cloud-arrow-up" class="relative mb-4 h-12 w-12 text-cyan-400" />
              <p class="relative font-label text-sm tracking-widest text-white">
                {{ uploading ? 'UPLOADING...' : 'DRAG & DROP OR' }}
                <span class="text-cyan-400 underline">BROWSE LOCAL STORAGE</span>
              </p>
              <p class="relative mt-1 font-label text-[10px] uppercase tracking-wider text-gray-500">PNG, JPEG, WEBP, GIF, PDF (Max 10MB)</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                class="hidden"
                :disabled="uploading"
                @change="handleFileUpload"
              >
            </label>

            <!-- Preview -->
            <img
              v-if="form.image_url"
              :src="form.image_url"
              alt="Preview"
              class="max-h-48 rounded-lg border border-white/10 object-contain"
            >

            <!-- Fields Grid -->
            <div class="grid grid-cols-2 gap-6">
              <div class="col-span-2 flex flex-col gap-2 md:col-span-1">
                <label class="font-label text-xs font-bold uppercase tracking-widest text-gray-400">Resource Title</label>
                <input
                  v-model="form.title"
                  type="text"
                  placeholder="Zero Trust Architecture Masterprint"
                  class="border-0 border-b border-white/20 bg-gray-900/60 p-3 text-white outline-none transition-all placeholder:text-gray-600 focus:border-cyan-400 focus:ring-0"
                >
              </div>

              <div class="col-span-2 flex flex-col gap-2 md:col-span-1">
                <label class="font-label text-xs font-bold uppercase tracking-widest text-gray-400">Category</label>
                <select
                  v-model="form.category"
                  class="appearance-none border-0 border-b border-white/20 bg-gray-900/60 p-3 text-white outline-none transition-all focus:border-cyan-400 focus:ring-0"
                >
                  <option value="">Select category</option>
                  <option>AI Security</option>
                  <option>Network Security</option>
                  <option>Cloud Security</option>
                  <option>Compliance</option>
                  <option>Incident Response</option>
                  <option>Best Practices</option>
                  <option>Threat Intel</option>
                </select>
              </div>

              <div class="col-span-2 flex flex-col gap-2">
                <label class="font-label text-xs font-bold uppercase tracking-widest text-gray-400">Technical Summary</label>
                <textarea
                  v-model="form.description"
                  rows="3"
                  placeholder="Provide high-level intelligence overview..."
                  class="resize-none border-0 border-b border-white/20 bg-gray-900/60 p-3 text-white outline-none transition-all placeholder:text-gray-600 focus:border-cyan-400 focus:ring-0"
                />
              </div>

              <div class="col-span-2 flex flex-col gap-2 md:col-span-1">
                <label class="font-label text-xs font-bold uppercase tracking-widest text-gray-400">Content Type</label>
                <select
                  v-model="form.content_type"
                  class="appearance-none border-0 border-b border-white/20 bg-gray-900/60 p-3 text-white outline-none transition-all focus:border-cyan-400 focus:ring-0"
                >
                  <option v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </div>

              <div class="col-span-2 flex flex-col gap-2 md:col-span-1">
                <label class="font-label text-xs font-bold uppercase tracking-widest text-gray-400">Tags</label>
                <input
                  v-model="form.tagsText"
                  type="text"
                  placeholder="comma-separated values"
                  class="border-0 border-b border-white/20 bg-gray-900/60 p-3 text-white outline-none transition-all placeholder:text-gray-600 focus:border-cyan-400 focus:ring-0"
                >
              </div>

              <button
                type="button"
                class="col-span-2 flex items-center justify-between rounded-lg bg-gray-800/30 p-4 text-left transition-colors hover:bg-gray-800/50 md:col-span-1"
                @click="form.featured = !form.featured"
              >
                <div>
                  <span class="font-label text-xs font-bold uppercase tracking-widest text-white">Featured Asset</span>
                  <span class="block text-[10px] text-gray-500">Prioritize in global repository</span>
                </div>
                <div class="relative h-5 w-10 rounded-full transition-colors" :class="form.featured ? 'bg-cyan-500' : 'bg-gray-700'">
                  <div class="absolute top-1 h-3 w-3 rounded-full bg-white transition-all" :class="form.featured ? 'left-6' : 'left-1'" />
                </div>
              </button>

              <button
                type="button"
                class="col-span-2 flex items-center justify-between rounded-lg bg-gray-800/30 p-4 text-left transition-colors hover:bg-gray-800/50 md:col-span-1"
                @click="form.status = form.status === 'published' ? 'draft' : 'published'"
              >
                <div>
                  <span class="font-label text-xs font-bold uppercase tracking-widest text-white">Publish</span>
                  <span class="block text-[10px] text-gray-500">Make visible on /resources</span>
                </div>
                <div class="relative h-5 w-10 rounded-full transition-colors" :class="form.status === 'published' ? 'bg-cyan-500' : 'bg-gray-700'">
                  <div class="absolute top-1 h-3 w-3 rounded-full bg-white transition-all" :class="form.status === 'published' ? 'left-6' : 'left-1'" />
                </div>
              </button>
            </div>

            <UAlert v-if="formError" color="red" variant="soft" title="Could not save">
              {{ formError }}
            </UAlert>
          </div>

          <!-- Action Bar -->
          <div class="flex items-center justify-end gap-4 border-t border-white/10 bg-gray-900/80 px-8 py-5">
            <button
              class="border border-white/20 px-6 py-2 font-label text-xs font-bold uppercase tracking-widest text-gray-400 transition-all hover:bg-gray-800 hover:text-white active:scale-95"
              @click="editOpen = false"
            >
              Discard
            </button>
            <button
              class="flex items-center gap-2 bg-gradient-to-br from-cyan-400 to-cyan-600 px-8 py-3 font-label text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 active:scale-95 disabled:opacity-50"
              :disabled="saving"
              @click="save"
            >
              {{ saving ? 'PROCESSING...' : 'INITIATE UPLOAD' }}
              <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete modal -->
    <UModal v-model:open="deleteOpen" title="Delete resource" description="This cannot be undone.">
      <template #content>
        <div class="space-y-4">
          <div class="text-sm text-gray-300">
            Delete <span class="font-medium text-gray-100">{{ deleting?.title }}</span>?
          </div>

          <UAlert v-if="deleteError" color="red" variant="soft" title="Could not delete">
            {{ deleteError }}
          </UAlert>

          <div class="flex items-center justify-end gap-2">
            <UButton color="gray" variant="soft" :disabled="deletingBusy" @click="deleteOpen = false">Cancel</UButton>
            <UButton color="red" :loading="deletingBusy" @click="confirmDelete">Delete</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type ResourceRow = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  content_type: 'poster' | 'infographic' | 'cheat_sheet' | 'guide' | string
  category: string | null
  tags: string[] | null
  status: 'draft' | 'published' | string
  featured: boolean
  created_at: string
  published_at: string | null
}

type ResourcesResponse = { items: ResourceRow[] }
type ResourceResponse = { resource: ResourceRow }
type OkResponse = { deleted: boolean }

const route = useRoute()

const filters = reactive({
  status: (route.query.status as string) || 'all'
})

const query = computed(() => {
  return {
    status: filters.status === 'all' ? undefined : filters.status
  }
})

const { data, pending, refresh } = await useFetch<ResourcesResponse>('/api/admin/resources', { query, watch: [query] })

const resources = computed(() => data.value?.items ?? [])

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' }
]

const typeOptions = [
  { label: 'Poster', value: 'poster' },
  { label: 'Infographic', value: 'infographic' },
  { label: 'Cheat sheet', value: 'cheat_sheet' },
  { label: 'Guide', value: 'guide' }
]

const VALID_TYPES = new Set(['poster', 'infographic', 'cheat_sheet', 'guide'])
const VALID_STATUS = new Set(['draft', 'published'])

function typeLabel(t: ResourceRow['content_type']) {
  switch (t) {
    case 'poster':
      return 'Poster'
    case 'infographic':
      return 'Infographic'
    case 'cheat_sheet':
      return 'Cheat sheet'
    case 'guide':
      return 'Guide'
    default:
      return String(t || '—')
  }
}

function parseTags(text: string): string[] {
  const raw = (text || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 50)
}

function tagsToText(tags: string[] | null): string {
  return Array.isArray(tags) ? tags.join(', ') : ''
}

const editOpen = ref(false)
const editMode = ref<'add' | 'edit'>('add')
const editingId = ref<string | null>(null)
const saving = ref(false)
const uploading = ref(false)
const formError = ref<string | null>(null)

async function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) return

  uploading.value = true
  formError.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await $fetch<{
      url: string
      ai?: { title: string; description: string; category: string; tags: string[] }
    }>('/api/admin/resources/upload', {
      method: 'POST',
      body: formData
    })
    form.image_url = res.url

    // Auto-fill from AI analysis (only fill empty fields)
    if (res.ai) {
      if (!form.title && res.ai.title) form.title = res.ai.title
      if (!form.description && res.ai.description) form.description = res.ai.description
      if (!form.category && res.ai.category) form.category = res.ai.category
      if (!form.tagsText && res.ai.tags?.length) form.tagsText = res.ai.tags.join(', ')
    }
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Upload failed'
  } finally {
    uploading.value = false
    if (input) input.value = ''
  }
}

const form = reactive<{
  title: string
  description: string
  image_url: string
  content_type: 'poster' | 'infographic' | 'cheat_sheet' | 'guide'
  category: string
  tagsText: string
  status: 'draft' | 'published'
  featured: boolean
}>({
  title: '',
  description: '',
  image_url: '',
  content_type: 'poster',
  category: '',
  tagsText: '',
  status: 'draft',
  featured: false
})

function getErrorMessage(e: unknown) {
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const data = obj.data
    if (data && typeof data === 'object') {
      const statusMessage = (data as Record<string, unknown>).statusMessage
      if (typeof statusMessage === 'string' && statusMessage) return statusMessage
    }
    const message = obj.message
    if (typeof message === 'string' && message) return message
  }
  return 'Unknown error'
}

function openAdd() {
  editMode.value = 'add'
  editingId.value = null
  form.title = ''
  form.description = ''
  form.image_url = ''
  form.content_type = 'poster'
  form.category = ''
  form.tagsText = ''
  form.status = 'draft'
  form.featured = false
  formError.value = null
  editOpen.value = true
}

function openEdit(r: ResourceRow) {
  editMode.value = 'edit'
  editingId.value = r.id
  form.title = r.title
  form.description = r.description || ''
  form.image_url = r.image_url || ''
  form.content_type = VALID_TYPES.has(String(r.content_type)) ? (r.content_type as 'poster' | 'infographic' | 'cheat_sheet' | 'guide') : 'poster'
  form.category = r.category || ''
  form.tagsText = tagsToText(r.tags)
  form.status = VALID_STATUS.has(String(r.status)) ? (r.status as 'draft' | 'published') : 'draft'
  form.featured = Boolean(r.featured)
  formError.value = null
  editOpen.value = true
}

async function save() {
  saving.value = true
  formError.value = null
  try {
    const payload = {
      title: form.title,
      description: form.description || null,
      image_url: form.image_url || null,
      content_type: form.content_type,
      category: form.category || null,
      tags: parseTags(form.tagsText),
      status: form.status,
      featured: form.featured
    }

    if (editMode.value === 'add') {
      await $fetch<ResourceResponse>('/api/admin/resources', {
        method: 'POST',
        body: payload
      })
    } else {
      const id = editingId.value
      if (!id) throw new Error('Missing resource id')
      await $fetch<ResourceResponse>(`/api/admin/resources/${id}`, {
        method: 'PATCH',
        body: payload
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

const toggleLoadingId = ref<string | null>(null)
async function togglePublished(r: ResourceRow, v: boolean) {
  toggleLoadingId.value = r.id
  try {
    await $fetch<ResourceResponse>(`/api/admin/resources/${r.id}`, {
      method: 'PATCH',
      body: { status: v ? 'published' : 'draft' }
    })
    await refresh()
  } finally {
    toggleLoadingId.value = null
  }
}

async function toggleFeatured(r: ResourceRow, v: boolean) {
  toggleLoadingId.value = r.id
  try {
    await $fetch<ResourceResponse>(`/api/admin/resources/${r.id}`, {
      method: 'PATCH',
      body: { featured: v }
    })
    await refresh()
  } finally {
    toggleLoadingId.value = null
  }
}

const deleteLoadingId = ref<string | null>(null)
const deleteOpen = ref(false)
const deleting = ref<ResourceRow | null>(null)
const deletingBusy = ref(false)
const deleteError = ref<string | null>(null)

function openDelete(r: ResourceRow) {
  deleting.value = r
  deleteError.value = null
  deleteOpen.value = true
}

async function confirmDelete() {
  const r = deleting.value
  if (!r) return

  deletingBusy.value = true
  deleteLoadingId.value = r.id
  deleteError.value = null
  try {
    await $fetch<OkResponse>(`/api/admin/resources/${r.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    await refresh()
  } catch (e) {
    deleteError.value = getErrorMessage(e)
  } finally {
    deletingBusy.value = false
    deleteLoadingId.value = null
  }
}
</script>
