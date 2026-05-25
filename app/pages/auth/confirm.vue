<template>
  <main class="py-20">
    <div class="mx-auto max-w-md px-6 text-center">
      <h1 class="text-2xl font-semibold tracking-tight text-white">Email confirmed</h1>

      <p v-if="verifying" class="mt-4 text-sm text-gray-300">
        Confirming your account…
      </p>

      <div v-else-if="errorMessage" class="mt-4 space-y-4">
        <p class="text-sm text-red-300">{{ errorMessage }}</p>
        <UButton to="/auth/login" variant="soft" color="neutral">Go to login</UButton>
      </div>

      <p v-else class="mt-4 text-sm text-gray-300">Redirecting…</p>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({
  title: 'Confirm account — ThreatNoir',
  description: 'Confirm your ThreatNoir account.'
})

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

  const desc = hashParams.get('error_description') || queryParams.get('error_description')

  if (!err && !desc) return null
  return desc || err || 'Unable to confirm your email.'
}

watch(
  user,
  async (u) => {
    if (!u) return

    verifying.value = false
    errorMessage.value = null

    try {
      await $fetch('/api/auth/ensure-subscriber', { method: 'POST' })
    } catch {
      // If this fails, we still want the user to proceed.
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    await navigateTo(redirect || '/')
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
      errorMessage.value = 'We could not confirm your account. The link may have expired.'
    }
  }, 8000)
})
</script>

