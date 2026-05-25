<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Weekly Roundups</h1>
        <p class="mt-1 text-sm text-gray-300">Review, edit, and publish the automated weekly roundup drafts.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <USelect v-model="filters.status" :items="statusOptions" size="sm" class="min-w-40" />
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
      </div>
    </div>

    <UCard>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wider text-gray-400">
              <th class="px-2 py-2">Week</th>
              <th class="px-2 py-2">Range</th>
              <th class="px-2 py-2">Status</th>
              <th class="px-2 py-2">Created</th>
              <th class="px-2 py-2">Published</th>
              <th class="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data?.items ?? []" :key="r.id" class="border-t border-gray-800 hover:bg-gray-950">
              <td class="px-2 py-2 font-mono text-xs text-gray-200">{{ r.week_label }}</td>
              <td class="px-2 py-2 text-xs text-gray-300">{{ r.date_from }} to {{ r.date_to }}</td>
              <td class="px-2 py-2">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  :class="r.status === 'published' ? 'bg-green-500/15 text-green-200' : 'bg-yellow-500/15 text-yellow-200'"
                >
                  {{ r.status }}
                </span>
              </td>
              <td class="px-2 py-2 text-xs text-gray-400">{{ fmtDate(r.created_at) }}</td>
              <td class="px-2 py-2 text-xs text-gray-400">{{ r.published_at ? fmtDate(r.published_at) : '—' }}</td>
              <td class="px-2 py-2" @click.stop>
                <div class="flex flex-wrap gap-2">
                  <UButton size="xs" color="gray" variant="soft" @click="openEdit(r)">Edit</UButton>
                  <UButton
                    v-if="r.status === 'draft'"
                    size="xs"
                    color="success"
                    variant="outline"
                    :loading="actionLoadingId === r.id"
                    @click="setStatus(r.id, 'published')"
                  >
                    Publish
                  </UButton>
                  <UButton
                    v-else
                    size="xs"
                    color="warning"
                    variant="outline"
                    :loading="actionLoadingId === r.id"
                    @click="setStatus(r.id, 'draft')"
                  >
                    Unpublish
                  </UButton>
                  <NuxtLink
                    v-if="r.slug"
                    :to="`/weekly/${r.slug}`"
                    target="_blank"
                    class="inline-flex items-center gap-2 rounded px-2 py-1 text-xs text-cyan-200 hover:bg-gray-900"
                  >
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4" />
                    View
                  </NuxtLink>
                </div>
              </td>
            </tr>

            <tr v-if="!pending && (data?.items?.length ?? 0) === 0">
              <td colspan="6" class="px-2 py-6 text-sm text-gray-400">No roundups found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal v-model:open="editOpen" title="Edit Weekly Roundup" description="Update the content and social copy, then publish." :ui="{ width: 'sm:max-w-4xl' }">
      <template #content>
        <div class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-gray-400">
              <div class="font-mono">{{ form.week_label }}</div>
              <div>{{ form.date_from }} to {{ form.date_to }}</div>
            </div>

            <div class="flex items-center gap-2">
              <UButton color="gray" variant="soft" :disabled="saving" @click="editOpen = false">Cancel</UButton>
              <UButton :loading="saving" @click="save">Save</UButton>
            </div>
          </div>

          <UFormGroup label="TLDR (3-5 bullet points, markdown list)">
            <UTextarea v-model="form.tldr" :rows="5" placeholder="- Bullet 1\n- Bullet 2\n- Bullet 3" />
          </UFormGroup>

          <UFormGroup label="Full brief (markdown)" required>
            <UTextarea v-model="form.full_brief" :rows="14" placeholder="# Weekly roundup\n\n## Highlights\n..." />
          </UFormGroup>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormGroup label="Social: X">
              <UTextarea v-model="form.social_x" :rows="6" placeholder="Short post for X." />
            </UFormGroup>
            <UFormGroup label="Social: LinkedIn">
              <UTextarea v-model="form.social_linkedin" :rows="6" placeholder="Longer post for LinkedIn." />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormGroup label="Top IOCs (JSON array)" help="Optional. If you edit this, keep it as an array of {type,value,context}.">
              <UTextarea v-model="form.top_iocs_json" :rows="8" placeholder="[]" />
            </UFormGroup>
            <UFormGroup label="Awareness links (JSON array)" help="Optional. Array of {slug,title}.">
              <UTextarea v-model="form.awareness_links_json" :rows="8" placeholder="[]" />
            </UFormGroup>
          </div>

          <UAlert v-if="formError" color="red" variant="soft" title="Could not save">
            {{ formError }}
          </UAlert>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type WeeklyRow = {
  id: string
  week_label: string
  slug: string | null
  date_from: string
  date_to: string
  tldr: string | null
  full_brief: string
  top_iocs: unknown
  awareness_links: unknown
  social_linkedin: string | null
  social_x: string | null
  article_count: number | null
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
  published_at: string | null
}

type ListResponse = {
  page: number
  pageSize: number
  total: number
  items: WeeklyRow[]
}

type PatchResponse = { roundup: WeeklyRow }

const route = useRoute()

const filters = reactive({
  status: (route.query.status as string) || 'all'
})

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' }
]

const query = computed(() => ({
  status: filters.status,
  page: 1,
  pageSize: 50
}))

const { data, pending, refresh } = await useFetch<ListResponse>('/api/admin/weekly', { query })

const editOpen = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const actionLoadingId = ref<string | null>(null)

const form = reactive({
  id: '',
  week_label: '',
  date_from: '',
  date_to: '',
  tldr: '',
  full_brief: '',
  social_x: '',
  social_linkedin: '',
  top_iocs_json: '[]',
  awareness_links_json: '[]'
})

function fmtDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toISOString().slice(0, 10)
  } catch {
    return iso
  }
}

function openEdit(r: WeeklyRow) {
  formError.value = null
  form.id = r.id
  form.week_label = r.week_label
  form.date_from = r.date_from
  form.date_to = r.date_to
  form.tldr = (r.tldr || '').trim()
  form.full_brief = (r.full_brief || '').trim()
  form.social_x = (r.social_x || '').trim()
  form.social_linkedin = (r.social_linkedin || '').trim()
  form.top_iocs_json = JSON.stringify(r.top_iocs ?? [], null, 2)
  form.awareness_links_json = JSON.stringify(r.awareness_links ?? [], null, 2)
  editOpen.value = true
}

function getErrorMessage(e: unknown) {
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const data = obj.data
    if (data && typeof data === 'object') {
      const statusMessage = (data as Record<string, unknown>).statusMessage
      if (typeof statusMessage === 'string' && statusMessage.trim()) return statusMessage
    }
    const message = obj.message
    if (typeof message === 'string' && message.trim()) return message
  }
  return 'Unknown error'
}

async function save() {
  saving.value = true
  formError.value = null
  try {
    const topIocs = JSON.parse(form.top_iocs_json || '[]')
    const awarenessLinks = JSON.parse(form.awareness_links_json || '[]')

    const payload = {
      tldr: form.tldr.trim() || null,
      full_brief: form.full_brief.trim(),
      social_x: form.social_x.trim() || null,
      social_linkedin: form.social_linkedin.trim() || null,
      top_iocs: topIocs,
      awareness_links: awarenessLinks
    }

    await $fetch<PatchResponse>(`/api/admin/weekly/${form.id}`, {
      method: 'PATCH',
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

async function setStatus(id: string, status: 'draft' | 'published') {
  actionLoadingId.value = id
  try {
    await $fetch<PatchResponse>(`/api/admin/weekly/${id}`, { method: 'PATCH', body: { status } })
    await refresh()
  } catch (e) {
    alert(getErrorMessage(e))
  } finally {
    actionLoadingId.value = null
  }
}
</script>
