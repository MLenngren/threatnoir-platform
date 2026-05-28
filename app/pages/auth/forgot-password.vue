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
              Password recovery
            </div>
          </div>

          <div class="mt-7 flex items-center justify-center gap-3">
            <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
            <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Recovery channel</span>
          </div>

          <form class="mt-7 space-y-5" @submit.prevent="onSubmit">
            <div class="space-y-2">
              <label for="auth-forgot-email" class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
                Email
              </label>
              <UFormGroup name="email">
                <UInput
                  id="auth-forgot-email"
                  v-model.trim="email"
                  type="email"
                  placeholder="you@company.com"
                  autocomplete="email"
                  color="neutral"
                  variant="subtle"
                  class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                />
              </UFormGroup>
            </div>

            <UAlert v-if="success" color="primary" variant="soft" title="Check your email">
              We sent reset instructions to <span class="font-medium">{{ email }}</span>.
            </UAlert>

            <UAlert v-if="errorMessage" color="red" variant="soft" title="Request failed">
              {{ errorMessage }}
            </UAlert>

            <UButton
              :loading="loading"
              block
              type="submit"
              :disabled="success"
              class="cursor-pointer rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-cyan-950/30 hover:brightness-110 disabled:opacity-70"
            >
              Send reset link
            </UButton>

            <div class="pt-1">
              <NuxtLink
                to="/auth/login"
                class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary transition-colors"
              >
                Back to login
              </NuxtLink>
            </div>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({
  title: 'Reset Password | ThreatNoir',
  description: 'Request a password reset link for your ThreatNoir account. We’ll email a secure link to set a new password and regain access.',
  ogTitle: 'Reset Password | ThreatNoir',
  ogDescription: 'Request a password reset link for your ThreatNoir account. We’ll email a secure link to set a new password and regain access.',
  ogImage: 'https://threatnoir.com/images/category-default.png',
  ogUrl: 'https://threatnoir.com/auth/forgot-password',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Reset Password | ThreatNoir',
  twitterDescription: 'Request a password reset link for your ThreatNoir account. We’ll email a secure link to set a new password and regain access.',
  twitterImage: 'https://threatnoir.com/images/category-default.png',
  author: 'Marcus Lenngren',
  robots: 'noindex'
})

const supabase = useSupabaseClient()

const email = ref('')
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

  const e = email.value.trim()
  if (!e) {
    errorMessage.value = 'Please enter your email address.'
    return
  }

  loading.value = true
  try {
    const redirectTo = `${window.location.origin}/auth/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo })
    if (error) throw error
    success.value = true
  } catch (err: unknown) {
    errorMessage.value = getErrorText(err)
  } finally {
    loading.value = false
  }
}
</script>

