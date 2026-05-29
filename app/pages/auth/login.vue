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
	              {{ site.name }}
            </div>
            <div class="mt-1 font-label text-[10px] uppercase tracking-[0.25em] text-tn-on-surface-variant">
              Secure access
            </div>
          </div>

          <div class="mt-7 flex items-center justify-center gap-3">
            <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
            <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Access terminal</span>
          </div>


          <form class="mt-7 space-y-5" @submit.prevent="onSubmit">
            <div class="rounded-2xl bg-tn-surface-lowest/60 p-5 ring-1 ring-white/10">
              <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">
                Log in to:
              </p>
              <ul class="mt-3 space-y-2 text-sm text-tn-on-surface-variant">
                <li class="flex gap-2">
                  <UIcon name="i-heroicons-check" class="mt-0.5 h-4 w-4 shrink-0 text-tn-primary" />
                  Customize notification channels (Email, Discord, Telegram, Webhook)
                </li>
                <li class="flex gap-2">
                  <UIcon name="i-heroicons-check" class="mt-0.5 h-4 w-4 shrink-0 text-tn-primary" />
                  Generate API keys (for MCP server + REST API)
                </li>
                <li class="flex gap-2">
                  <UIcon name="i-heroicons-check" class="mt-0.5 h-4 w-4 shrink-0 text-tn-primary" />
                  Manage subscription preferences and topics
                </li>
              </ul>
              <p class="mt-3 text-xs leading-5 text-tn-on-surface-variant">
                Most content is free without an account — podcasts, IOCs, articles, and weekly briefs are all public.
              </p>
            </div>

            <div class="space-y-2">
              <label for="auth-login-email" class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
                Email
              </label>
              <UFormGroup name="email">
                <UInput
                  id="auth-login-email"
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

            <div class="space-y-2">
              <label for="auth-login-password" class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant">
                Password
              </label>
              <UFormGroup name="password">
                <UInput
                  id="auth-login-password"
                  v-model="password"
                  type="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  color="neutral"
                  variant="subtle"
                  class="w-full bg-tn-surface-lowest/60 text-tn-on-surface placeholder:text-tn-on-surface-variant/70 ring-0 shadow-none border-0 rounded-none border-b-2 border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-tn-primary"
                />
              </UFormGroup>
            </div>

            <UAlert v-if="successMessage" color="primary" variant="soft" title="Success">
              {{ successMessage }}
            </UAlert>

            <UAlert v-if="errorMessage" color="red" variant="soft" title="Login failed">
              {{ errorMessage }}
            </UAlert>

            <UButton
              :loading="loading"
              block
              type="submit"
              class="cursor-pointer rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-cyan-950/30 hover:brightness-110"
            >
              Access terminal
            </UButton>

            <div class="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <NuxtLink
                to="/auth/forgot-password"
                class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary transition-colors"
              >
                Forgot password?
              </NuxtLink>
              <NuxtLink
                :to="signupHref"
                class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary transition-colors"
              >
                Create account
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

	const site = useSiteConfig()
	const pageTitle = 'Log In'
	const description = computed(
	  () =>
	    `Log in to your ${site.name} account to manage notifications, API keys, preferences, and delivery channels for email, Discord, Telegram, and webhooks.`
	)
	const pageUrl = computed(() => `${site.url}/auth/login`)

useSeoMeta({
	  title: pageTitle,
	  description,
	  ogTitle: `${pageTitle} | ${site.name}`,
	  ogDescription: description,
	  ogImage: site.ogImageUrl,
	  ogUrl: pageUrl,
  ogType: 'website',
  twitterCard: 'summary_large_image',
	  twitterTitle: `${pageTitle} | ${site.name}`,
	  twitterDescription: description,
	  twitterImage: site.ogImageUrl,
	  author: site.name,
  robots: 'noindex'
})

const supabase = useSupabaseClient()
const route = useRoute()

const email = ref('')
const password = ref('')

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const redirectTo = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : ''))
const signupHref = computed(() => {
  const q = redirectTo.value ? `?redirect=${encodeURIComponent(redirectTo.value)}` : ''
  return `/auth/signup${q}`
})

watchEffect(() => {
  const msg = typeof route.query.message === 'string' ? route.query.message : ''
  if (msg === 'reset-success') {
    successMessage.value = 'Password updated. You can log in now.'
  }
})

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
  successMessage.value = null

  const e = email.value.trim()
  if (!e) {
    errorMessage.value = 'Please enter your email address.'
    return
  }
  if (!password.value) {
    errorMessage.value = 'Please enter your password.'
    return
  }

  loading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: e,
      password: password.value
    })

    if (error) throw error

    // Best-effort: link auth user to subscribers.
    try {
      await $fetch('/api/auth/ensure-subscriber', { method: 'POST' })
    } catch {
      // Ignore; this is idempotent and non-critical for login.
    }

    await navigateTo(redirectTo.value || '/')
  } catch (err: unknown) {
    errorMessage.value = getErrorText(err)
  } finally {
    loading.value = false
  }
}
</script>

