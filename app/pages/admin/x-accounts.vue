<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">X / Twitter accounts</h1>
        <p class="mt-1 text-sm text-gray-300">Curated accounts used for X ingestion.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton size="sm" @click="openAdd">Add account</UButton>
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
      </div>
    </div>

    <UCard>
      <div class="mt-1 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">Username</th>
              <th class="px-2 py-2">Display name</th>
              <th class="px-2 py-2">Active</th>
              <th class="px-2 py-2">Created</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in accounts"
              :key="a.id"
              class="border-b border-gray-900"
            >
              <td class="px-2 py-2">
                <div class="font-mono text-gray-100">@{{ a.username }}</div>
              </td>
              <td class="px-2 py-2 text-gray-300">
                {{ a.display_name || '—' }}
              </td>
              <td class="px-2 py-2" @click.stop>
                <UToggle
                  :model-value="a.is_active"
                  :disabled="toggleLoadingId === a.id"
                  @update:model-value="(v) => toggleActive(a, v)"
                />
              </td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(a.created_at) }}</td>
              <td class="px-2 py-2" @click.stop>
                <UButton
                  size="xs"
                  color="red"
                  variant="soft"
                  :loading="deleteLoadingId === a.id"
                  @click="openDelete(a)"
                >
                  Delete
                </UButton>
              </td>
            </tr>

            <tr v-if="accounts.length === 0">
              <td colspan="5" class="px-2 py-6 text-center text-sm text-gray-400">No accounts.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Add Modal -->
    <UModal v-model:open="addOpen" title="Add X account" description="Enter a username (without @).">
      <template #content>
        <div class="space-y-5">
          <UFormGroup label="Username" required>
            <UInput v-model="form.username" placeholder="TheDFIRReport" />
          </UFormGroup>

          <UFormGroup label="Display name">
            <UInput v-model="form.display_name" placeholder="The DFIR Report" />
          </UFormGroup>

          <div v-if="formError" class="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {{ formError }}
          </div>

          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="soft" :disabled="saving" @click="addOpen = false">Cancel</UButton>
            <UButton :loading="saving" @click="save">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Modal -->
    <UModal v-model:open="deleteOpen" title="Delete account" description="This removes the account from ingestion.">
      <template #content>
        <div class="space-y-4">
          <p class="text-sm text-gray-300">
            Delete <span class="font-mono text-gray-100">@{{ deleting?.username }}</span>?
          </p>
          <div class="flex justify-end gap-2">
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

type AccountRow = {
  id: string
  username: string
  display_name: string | null
  is_active: boolean
  created_at: string
}

type AccountsResponse = { accounts: AccountRow[] }
type AccountResponse = { account: AccountRow }
type OkResponse = { ok: boolean }

const { data, pending, refresh } = await useFetch<AccountsResponse>('/api/admin/x-accounts')
const accounts = computed(() => data.value?.accounts ?? [])

const addOpen = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive<{ username: string; display_name: string }>({ username: '', display_name: '' })

const toggleLoadingId = ref<string | null>(null)
const deleteLoadingId = ref<string | null>(null)

const deleteOpen = ref(false)
const deleting = ref<AccountRow | null>(null)
const deletingBusy = ref(false)

function fmtDate(d: string) {
  return new Date(d).toLocaleString()
}

function openAdd() {
  form.username = ''
  form.display_name = ''
  formError.value = null
  addOpen.value = true
}

async function save() {
  const username = form.username.trim().replace(/^@/, '')
  if (!username) {
    formError.value = 'Username is required'
    return
  }

  saving.value = true
  formError.value = null
  try {
    await $fetch<AccountResponse>('/api/admin/x-accounts', {
      method: 'POST',
      body: {
        username,
        display_name: form.display_name.trim() || null
      }
    })
    addOpen.value = false
    await refresh()
  } catch (err: unknown) {
    formError.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function toggleActive(a: AccountRow, v: boolean) {
  toggleLoadingId.value = a.id
  try {
    await $fetch<AccountResponse>(`/api/admin/x-accounts/${a.id}`, {
      method: 'PATCH',
      body: { is_active: v }
    })
    await refresh()
  } finally {
    toggleLoadingId.value = null
  }
}

function openDelete(a: AccountRow) {
  deleting.value = a
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleting.value) return
  deletingBusy.value = true
  deleteLoadingId.value = deleting.value.id
  try {
    await $fetch<OkResponse>(`/api/admin/x-accounts/${deleting.value.id}`, { method: 'DELETE' })
    deleteOpen.value = false
    deleting.value = null
    await refresh()
  } finally {
    deletingBusy.value = false
    deleteLoadingId.value = null
  }
}
</script>
