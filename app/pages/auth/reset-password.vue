<template>
  <main class="grid-bg">
    <div class="min-h-[calc(100vh-theme(spacing.20))] flex items-center justify-center px-6 py-10">
      <section class="glass-panel relative w-full max-w-md overflow-hidden rounded-xl p-8 md:p-10">
        <!-- Decorative backdrop -->
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-tn-primary/10 blur-3xl" />
          <svg
            class="absolute -bottom-24 -right-16 h-80 w-80 text-tn-primary opacity-[0.06]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12 2l7 4v6c0 5.25-3.5 9.75-7 10-3.5-.25-7-4.75-7-10V6l7-4zm0 3.15L7 7v5c0 4.1 2.5 7.8 5 8.7 2.5-.9 5-4.6 5-8.7V7l-5-1.85z"
            />
          </svg>
        </div>

        <div class="relative">
          <div class="text-center">
            <div class="font-headline text-2xl font-black tracking-tight text-tn-primary uppercase">
              THREATNOIR
            </div>
            <div class="mt-1 font-label text-[10px] uppercase tracking-[0.25em] text-tn-on-surface-variant">
              Reset password
            </div>
          </div>

          <div class="mt-7 flex items-center justify-center gap-3">
            <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
            <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Credential update</span>
          </div>

          <form class="mt-7 space-y-5" @submit.prevent="onSubmit">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <label for="auth-reset-password" class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
                  New password
                </label>
                <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant/80">Min 8 chars</span>
              </div>
              <UFormGroup name="password" hint="Minimum 8 characters">
                <UInput
                  id="auth-reset-password"
                  v-model="password"
                  type="password"
                  placeholder="••••••••"
                  autocomplete="new-password"
                  color="neutral"
                  variant="subtle"
                  class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                />
              </UFormGroup>
            </div>

            <div class="space-y-2">
              <label for="auth-reset-confirm" class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
                Confirm password
              </label>
              <UFormGroup name="confirm">
                <UInput
                  id="auth-reset-confirm"
                  v-model="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autocomplete="new-password"
                  color="neutral"
                  variant="subtle"
                  class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                />
              </UFormGroup>
            </div>

            <UAlert v-if="success" color="primary" variant="soft" title="Password updated">
              Redirecting to login…
            </UAlert>

            <UAlert v-if="errorMessage" color="red" variant="soft" title="Reset failed">
              {{ errorMessage }}
            </UAlert>

            <UButton
              :loading="loading"
              block
              type="submit"
              :disabled="success"
              class="cursor-pointer rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-cyan-950/30 hover:brightness-110 disabled:opacity-70"
            >
              Update password
            </UButton>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({
  title: 'Set New Password | ThreatNoir',
  description: 'Set a new password for your ThreatNoir account. If you requested a reset link, you can securely update your credentials here.',
  ogTitle: 'Set New Password | ThreatNoir',
  ogDescription: 'Set a new password for your ThreatNoir account. If you requested a reset link, you can securely update your credentials here.',
  ogImage: 'https://threatnoir.com/images/category-default.png',
  ogUrl: 'https://threatnoir.com/auth/reset-password',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Set New Password | ThreatNoir',
  twitterDescription: 'Set a new password for your ThreatNoir account. If you requested a reset link, you can securely update your credentials here.',
  twitterImage: 'https://threatnoir.com/images/category-default.png',
  author: 'ThreatNoir',
  robots: 'noindex'
})

const supabase = useSupabaseClient()

const password = ref('')
const confirmPassword = ref('')

const loading = ref(false)
const success = ref(false)
const errorMessage = ref<string | null>(null)

function getErrorText(err: unknown): string {
  if (!err) return 'Unknown error.'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  const e = err as Record<string, unknown>
  const message = typeof e?.message === 'string' ? (e.message as string) : null
  return message || 'Unknown error.'
}

async function onSubmit() {
  errorMessage.value = null

  if (!password.value || password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) throw error

    success.value = true
    setTimeout(() => {
      navigateTo('/auth/login?message=reset-success')
    }, 500)
  } catch (err: unknown) {
    errorMessage.value = getErrorText(err)
  } finally {
    loading.value = false
  }
}
</script>

