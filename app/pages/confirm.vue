<template>
  <div class="mx-auto max-w-md py-20 text-center">
    <h1 class="text-2xl font-semibold tracking-tight">
      Confirming your login…
    </h1>

    <p v-if="verifying" class="mt-4 text-sm text-gray-300">
      Please wait while we verify your magic link.
    </p>

    <div v-else-if="errorMessage" class="mt-4 space-y-4">
      <p class="text-sm text-red-400">{{ errorMessage }}</p>
      <UButton to="/admin/login" variant="soft" color="neutral">
        Try again
      </UButton>
    </div>

    <p v-else class="mt-4 text-sm text-gray-300">Redirecting…</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const user = useSupabaseUser()
const route = useRoute()

const verifying = ref(true)
const errorMessage = ref<string | null>(null)

function parseCallbackError(): string | null {
  const hash = (route.hash || '').replace(/^#/, '')
  const hashParams = new URLSearchParams(hash)
  const queryParams = new URLSearchParams(route.fullPath.split('?')[1] || '')

  const err =
    hashParams.get('error') ||
    queryParams.get('error') ||
    hashParams.get('error_code') ||
    queryParams.get('error_code')

  const desc =
    hashParams.get('error_description') || queryParams.get('error_description')

  if (!err && !desc) return null
  return desc || err || 'Unable to confirm your login.'
}

watch(
  user,
  async (u) => {
    if (u) {
      verifying.value = false
      errorMessage.value = null
      await navigateTo('/admin')
    }
  },
  { immediate: true }
)

onMounted(() => {
  const callbackError = parseCallbackError()
  if (callbackError) {
    verifying.value = false
    errorMessage.value = callbackError
    return
  }

  setTimeout(() => {
    if (!user.value) {
      verifying.value = false
      errorMessage.value =
        'We could not confirm your login. The link may have expired.'
    }
  }, 8000)
})
</script>
