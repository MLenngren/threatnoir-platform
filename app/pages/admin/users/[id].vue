<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">User</h1>
        <p class="mt-1 text-sm text-gray-300">
          <span class="font-mono text-gray-100">{{ userId }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton color="gray" variant="soft" size="sm" :loading="pending" @click="refresh">Refresh</UButton>
        <UButton
          size="sm"
          :color="profile?.is_blocked ? 'green' : 'red'"
          variant="soft"
          :loading="blocking"
          @click="toggleBlock()"
        >
          {{ profile?.is_blocked ? 'Unblock' : 'Block' }}
        </UButton>
        <UButton color="red" variant="soft" size="sm" :loading="deletingBusy" @click="deleteOpen = true">Delete</UButton>
      </div>
    </div>

    <UAlert v-if="errorText" color="red" variant="soft" title="Could not load user">
      {{ errorText }}
    </UAlert>

    <div v-if="item" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UCard>
        <template #header>
          <div class="text-sm font-medium text-gray-100">Profile</div>
        </template>

        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between gap-4">
            <div class="text-gray-400">Email</div>
            <div class="text-gray-100">{{ item.user.email || '—' }}</div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <div class="text-gray-400">Display name</div>
            <div class="text-gray-100">{{ profile?.display_name || '—' }}</div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <div class="text-gray-400">Blocked</div>
            <div class="text-gray-100">{{ profile?.is_blocked ? 'Yes' : 'No' }}</div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <div class="text-gray-400">Created</div>
            <div class="text-gray-100">{{ fmtDate(item.user.created_at) }}</div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <div class="text-gray-400">Last login</div>
            <div class="text-gray-100">{{ fmtDate(item.user.last_sign_in_at) }}</div>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="text-sm font-medium text-gray-100">Metadata</div>
        </template>

        <div class="space-y-3">
          <div>
            <div class="text-xs uppercase tracking-wider text-gray-400">App metadata</div>
            <pre class="mt-1 overflow-auto rounded bg-black/40 p-3 text-xs text-gray-200">{{ pretty(item.user.app_metadata) }}</pre>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wider text-gray-400">User metadata</div>
            <pre class="mt-1 overflow-auto rounded bg-black/40 p-3 text-xs text-gray-200">{{ pretty(item.user.user_metadata) }}</pre>
          </div>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-gray-100">API keys</div>
          <div class="text-sm text-gray-400">{{ apiKeys.length }}</div>
        </div>
      </template>

      <div class="mt-1 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">Prefix</th>
              <th class="px-2 py-2">Name</th>
              <th class="px-2 py-2">Scopes</th>
              <th class="px-2 py-2">Last used</th>
              <th class="px-2 py-2">Created</th>
              <th class="px-2 py-2">Revoked</th>
              <th class="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="k in apiKeys" :key="k.id" class="border-b border-gray-900">
              <td class="px-2 py-2 font-mono text-xs text-gray-200">{{ k.key_prefix }}</td>
              <td class="px-2 py-2 text-gray-200">{{ k.name || '—' }}</td>
              <td class="px-2 py-2 text-gray-300">{{ (k.scopes || []).join(', ') || '—' }}</td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(k.last_used_at) }}</td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(k.created_at) }}</td>
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(k.revoked_at) }}</td>
              <td class="px-2 py-2" @click.stop>
                <UButton
                  size="xs"
                  color="red"
                  variant="soft"
                  :disabled="!!k.revoked_at"
                  :loading="revokeLoadingId === k.id"
                  @click="revokeKey(k.id)"
                >
                  Revoke
                </UButton>
              </td>
            </tr>

            <tr v-if="!pending && apiKeys.length === 0">
              <td colspan="7" class="px-2 py-6 text-center text-sm text-gray-400">No API keys.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-gray-100">Audit log</div>
          <div class="text-sm text-gray-400">{{ auditItems.length }}</div>
        </div>
      </template>

      <div class="mt-1 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs uppercase tracking-wider text-gray-400">
            <tr class="border-b border-gray-800">
              <th class="px-2 py-2">When</th>
              <th class="px-2 py-2">Action</th>
              <th class="px-2 py-2">Resource</th>
              <th class="px-2 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in auditItems" :key="a.id" class="border-b border-gray-900">
              <td class="px-2 py-2 text-gray-300">{{ fmtDate(a.created_at) }}</td>
              <td class="px-2 py-2 font-mono text-xs text-gray-200">{{ a.action }}</td>
              <td class="px-2 py-2 font-mono text-xs text-gray-300">{{ a.resource_type }} {{ a.resource_id || '' }}</td>
              <td class="px-2 py-2 font-mono text-xs text-gray-300">{{ a.user_id || '—' }}</td>
            </tr>

            <tr v-if="!pending && auditItems.length === 0">
              <td colspan="4" class="px-2 py-6 text-center text-sm text-gray-400">No audit entries.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal v-model:open="deleteOpen" title="Delete user" description="This permanently deletes the user and revokes all API keys.">
      <template #content>
        <div class="space-y-4">
          <div class="text-sm text-gray-300">
            Delete <span class="font-mono text-gray-100">{{ item?.user.email || userId }}</span>?
            This cannot be undone.
          </div>

          <UAlert v-if="deleteError" color="red" variant="soft" title="Could not delete">
            {{ deleteError }}
          </UAlert>

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

type ApiKeyItem = {
  id: string
  key_prefix: string
  name: string | null
  scopes: string[] | null
  last_used_at: string | null
  created_at: string | null
  revoked_at: string | null
}

type AuditItem = {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

type ProfileRow = {
  user_id: string
  display_name: string | null
  is_blocked: boolean
  created_at: string
  updated_at: string
}

type UserEnvelope = {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  app_metadata: unknown
  user_metadata: unknown
}

type UserDetailResponse = {
  user: UserEnvelope
  profile: ProfileRow | null
  apiKeys: ApiKeyItem[]
  audit: { user: AuditItem[]; api_keys: AuditItem[] }
}

const route = useRoute()
const userId = computed(() => String(route.params.id || ''))

const { data, pending, refresh, error } = await useFetch<UserDetailResponse>(() => `/api/admin/users/${userId.value}`)

const item = computed(() => (data.value ? { user: data.value.user } : null))
const profile = computed(() => data.value?.profile ?? null)
const apiKeys = computed(() => data.value?.apiKeys ?? [])

const auditItems = computed(() => {
  const all = [...(data.value?.audit?.user ?? []), ...(data.value?.audit?.api_keys ?? [])]
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
})

const errorText = computed(() => {
  const e = error.value as unknown
  if (!e) return null
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
})

const blocking = ref(false)
const revokeLoadingId = ref<string | null>(null)

const deleteOpen = ref(false)
const deletingBusy = ref(false)
const deleteError = ref<string | null>(null)

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function pretty(v: unknown) {
  try {
    return JSON.stringify(v ?? null, null, 2)
  } catch {
    return String(v)
  }
}

async function toggleBlock() {
  if (!profile.value) return
  blocking.value = true
  try {
    await $fetch(`/api/admin/users/${userId.value}/block`, {
      method: 'PATCH',
      body: { is_blocked: !profile.value.is_blocked }
    })
    await refresh()
  } finally {
    blocking.value = false
  }
}

async function revokeKey(keyId: string) {
  revokeLoadingId.value = keyId
  try {
    await $fetch(`/api/admin/users/${userId.value}/api-keys/${keyId}`, { method: 'DELETE' })
    await refresh()
  } finally {
    revokeLoadingId.value = null
  }
}

async function confirmDelete() {
  deleteError.value = null
  deletingBusy.value = true
  try {
    await $fetch(`/api/admin/users/${userId.value}`, { method: 'DELETE' })
    deleteOpen.value = false
    await navigateTo('/admin/users')
  } catch (e: unknown) {
    deleteError.value = e instanceof Error ? e.message : String(e)
  } finally {
    deletingBusy.value = false
  }
}
</script>
