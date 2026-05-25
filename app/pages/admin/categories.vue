<template>
  <div class="categories-admin">
    <!-- Header -->
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="mb-1 text-xs tracking-widest text-gray-500 uppercase">Admin</div>
        <h1 class="text-xl font-bold tracking-tight text-gray-50 sm:text-2xl">Categories &amp; Tags</h1>
        <p class="mt-1 text-sm text-gray-400">Primary classification and multi-label tags for articles.</p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <UButton
          class="cursor-pointer transition-all duration-150 hover:shadow-[0_0_12px_rgba(99,102,241,0.2)]"
          @click="openAdd"
        >
          + Add category
        </UButton>
        <UButton color="neutral" variant="ghost" class="cursor-pointer" size="sm" :loading="pending" @click="refresh">
          Refresh
        </UButton>
      </div>
    </div>

    <!-- AI sync notice -->
    <div class="mb-6 rounded-lg border border-amber-900/30 bg-amber-950/20 px-4 py-3">
      <div class="flex items-start gap-3">
        <span class="mt-0.5 text-amber-500">&#9888;</span>
        <div>
          <div class="text-xs font-semibold text-amber-300">AI classifier sync</div>
          <div class="mt-0.5 text-xs leading-relaxed text-amber-400/70">
            Categories power both primary classification and tags. After adding or removing categories, update the AI prompt in
            <code class="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px] text-amber-300">server/utils/anthropic.ts</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Section divider -->
    <div class="mb-6 flex items-center gap-3">
      <div class="h-px grow bg-gradient-to-r from-gray-800 to-transparent" />
      <span class="text-[11px] font-semibold tracking-[0.2em] text-gray-500 uppercase">
        {{ categories.length }} categories
      </span>
      <div class="h-px grow bg-gradient-to-l from-gray-800 to-transparent" />
    </div>

    <!-- Categories table -->
    <div class="rounded-xl border border-gray-800/80 bg-gray-950/40 backdrop-blur-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-gray-800/60">
              <th class="px-5 py-3 text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase">Name</th>
              <th class="px-4 py-3 text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase">Slug</th>
              <th class="px-4 py-3 text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase">Description</th>
              <th class="px-4 py-3 text-center text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase">Order</th>
              <th class="px-4 py-3 text-[11px] font-semibold tracking-[0.15em] text-gray-500 uppercase">Usage</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, idx) in categories"
              :key="c.id"
              class="group cursor-pointer border-b border-gray-800/30 transition-colors duration-100 hover:bg-white/[0.02]"
              @click="openEdit(c)"
            >
              <td class="px-5 py-3.5">
                <div class="font-semibold text-gray-100">{{ c.name }}</div>
              </td>
              <td class="px-4 py-3.5">
                <code class="rounded border border-gray-800/50 bg-black/30 px-1.5 py-0.5 font-mono text-xs text-gray-400">{{ c.slug }}</code>
              </td>
              <td class="max-w-[320px] px-4 py-3.5">
                <span v-if="c.description" class="block truncate text-xs leading-relaxed text-gray-400" :title="c.description">{{ c.description }}</span>
                <span v-else class="text-xs text-gray-600">—</span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span class="font-mono text-xs text-gray-500">{{ c.sort_order }}</span>
              </td>
              <td class="px-4 py-3.5" @click.stop>
                <NuxtLink
                  :to="`/admin/articles?categoryId=${c.id}&sort=published_at&order=desc&status=all`"
                  class="inline-flex items-center gap-3 rounded-md px-2 py-1 text-xs transition-colors hover:bg-white/[0.04]"
                >
                  <span class="text-gray-300">
                    <span class="font-semibold text-gray-100">{{ c.primary_count }}</span> primary
                  </span>
                  <span class="text-gray-600">|</span>
                  <span class="text-gray-300">
                    <span class="font-semibold text-gray-100">{{ c.tag_count }}</span> tagged
                  </span>
                  <span class="text-gray-600 transition-colors group-hover:text-gray-400">&rarr;</span>
                </NuxtLink>
              </td>
              <td class="px-4 py-3.5" @click.stop>
                <div class="flex items-center justify-end gap-1.5 opacity-50 transition-opacity duration-150 group-hover:opacity-100">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    class="cursor-pointer transition-colors"
                    :disabled="reorderBusy || idx === 0"
                    @click="moveUp(c)"
                  >
                    &uarr;
                  </UButton>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    class="cursor-pointer transition-colors"
                    :disabled="reorderBusy || idx === categories.length - 1"
                    @click="moveDown(c)"
                  >
                    &darr;
                  </UButton>
                  <div class="mx-1 h-4 w-px bg-gray-800/60" />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    class="cursor-pointer transition-colors"
                    @click="openEdit(c)"
                  >
                    Edit
                  </UButton>
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    class="cursor-pointer transition-colors"
                    :loading="deleteLoadingId === c.id"
                    @click="openDelete(c)"
                  >
                    Delete
                  </UButton>
                </div>
              </td>
            </tr>
            <tr v-if="!pending && categories.length === 0">
              <td colspan="6" class="px-5 py-12 text-center text-sm text-gray-500">No categories found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <UModal
      v-model:open="editOpen"
      :title="editMode === 'add' ? 'Add category' : 'Edit category'"
      :description="editMode === 'add' ? 'Create a new category for classification and tagging.' : 'Update name, slug, and description.'"
    >
      <template #content>
        <div class="space-y-5">
          <UFormGroup label="Name" required>
            <UInput v-model="form.name" placeholder="Ransomware" />
          </UFormGroup>

          <UFormGroup label="Slug" required>
            <UInput v-model="form.slug" placeholder="ransomware" @update:model-value="onSlugInput" />
          </UFormGroup>

          <UFormGroup label="Description">
            <UTextarea v-model="form.description" :rows="3" placeholder="Used in category pages and AI classification prompt." />
          </UFormGroup>

          <UAlert v-if="formError" color="red" variant="soft" title="Could not save">
            {{ formError }}
          </UAlert>

          <div class="flex items-center justify-end gap-2 border-t border-gray-800/60 pt-4">
            <UButton color="neutral" variant="ghost" :disabled="saving" @click="editOpen = false">Cancel</UButton>
            <UButton
              :loading="saving"
              class="cursor-pointer transition-all duration-150 hover:shadow-[0_0_12px_rgba(99,102,241,0.15)]"
              @click="save"
            >
              {{ editMode === 'add' ? 'Create category' : 'Save changes' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Modal -->
    <UModal v-model:open="deleteOpen" title="Delete category" description="This action cannot be undone.">
      <template #content>
        <div class="space-y-4">
          <div class="text-sm text-gray-300">
            Delete <span class="font-semibold text-gray-100">{{ deleteTarget?.name }}</span>?
          </div>

          <UAlert v-if="deleteTarget && (deleteTarget.primary_count > 0 || deleteTarget.tag_count > 0)" color="warning" variant="soft">
            This category is in use ({{ deleteTarget.primary_count }} primary / {{ deleteTarget.tag_count }} tagged) and cannot be deleted.
          </UAlert>

          <UAlert v-if="deleteError" color="error" variant="soft" title="Could not delete">
            {{ deleteError }}
          </UAlert>

          <div class="flex items-center justify-end gap-2 border-t border-gray-800/60 pt-4">
            <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">Cancel</UButton>
            <UButton
              color="error"
              variant="outline"
              class="cursor-pointer transition-all duration-150 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)]"
              :loading="deleting"
              :disabled="(deleteTarget?.primary_count ?? 0) > 0 || (deleteTarget?.tag_count ?? 0) > 0"
              @click="confirmDelete"
            >
              Delete permanently
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  primary_count: number
  tag_count: number
}

type CategoriesResponse = { categories: CategoryRow[] }
type CategoryResponse = { category: CategoryRow }
type OkResponse = { ok: boolean }

const { data, pending, refresh } = await useFetch<CategoriesResponse>('/api/admin/categories')
const categories = computed(() => data.value?.categories ?? [])

const editOpen = ref(false)
const editMode = ref<'add' | 'edit'>('add')
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)

const slugTouched = ref(false)

const form = reactive<{ name: string; slug: string; description: string }>({
  name: '',
  slug: '',
  description: ''
})

const deleteOpen = ref(false)
const deleteTarget = ref<CategoryRow | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)
const deleteLoadingId = ref<string | null>(null)

const reorderBusy = ref(false)

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

function toKebabCase(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

watch(
  () => form.name,
  (name) => {
    if (editMode.value !== 'add') return
    if (slugTouched.value) return
    form.slug = toKebabCase(name)
  }
)

function onSlugInput() {
  slugTouched.value = true
}

function openAdd() {
  editMode.value = 'add'
  editingId.value = null
  form.name = ''
  form.slug = ''
  form.description = ''
  slugTouched.value = false
  formError.value = null
  editOpen.value = true
}

function openEdit(c: CategoryRow) {
  editMode.value = 'edit'
  editingId.value = c.id
  form.name = c.name
  form.slug = c.slug
  form.description = c.description ?? ''
  slugTouched.value = true
  formError.value = null
  editOpen.value = true
}

async function save() {
  saving.value = true
  formError.value = null
  try {
    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description.trim() ? form.description : null
    }

    if (editMode.value === 'add') {
      await $fetch<CategoryResponse>('/api/admin/categories', {
        method: 'POST',
        body: payload
      })
    } else {
      const id = editingId.value
      if (!id) throw new Error('Missing category id')
      await $fetch<CategoryResponse>(`/api/admin/categories/${id}`, {
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

function openDelete(c: CategoryRow) {
  deleteTarget.value = c
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
    await $fetch<OkResponse>(`/api/admin/categories/${target.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    await refresh()
  } catch (e) {
    deleteError.value = getErrorMessage(e)
  } finally {
    deleting.value = false
    deleteLoadingId.value = null
  }
}

async function swapSort(a: CategoryRow, b: CategoryRow) {
  reorderBusy.value = true
  try {
    // Swap via two updates.
    await $fetch<CategoryResponse>(`/api/admin/categories/${a.id}`, { method: 'PATCH', body: { sort_order: b.sort_order } })
    await $fetch<CategoryResponse>(`/api/admin/categories/${b.id}`, { method: 'PATCH', body: { sort_order: a.sort_order } })
    await refresh()
  } finally {
    reorderBusy.value = false
  }
}

async function moveUp(c: CategoryRow) {
  const list = categories.value
  const idx = list.findIndex((x) => x.id === c.id)
  if (idx <= 0) return
  await swapSort(list[idx], list[idx - 1])
}

async function moveDown(c: CategoryRow) {
  const list = categories.value
  const idx = list.findIndex((x) => x.id === c.id)
  if (idx < 0 || idx >= list.length - 1) return
  await swapSort(list[idx], list[idx + 1])
}
</script>
