<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-2xl px-6">
      <section class="glass-panel rounded-2xl p-6 md:p-8">
        <div v-if="success" class="space-y-6">
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-tn-primary/10 ring-1 ring-tn-primary/25">
                <UIcon name="i-heroicons-check" class="h-6 w-6 text-tn-primary" />
              </span>
              <div>
                <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Confirmed</div>
                <h1 class="mt-1 font-headline text-2xl font-black tracking-tight text-tn-on-surface md:text-3xl">You’re on the list.</h1>
              </div>
            </div>
            <p class="mt-4 text-sm leading-6 text-tn-on-surface-variant md:text-base">
              We’ll notify you at <span class="font-semibold text-tn-on-surface">{{ submittedEmail }}</span> when the
              extended edition launches. In the meantime, check out our daily briefings.
            </p>
          </div>

          <NuxtLink
            to="/podcast"
            class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
          >
            Listen to Today’s Briefing →
          </NuxtLink>
        </div>

        <div v-else>
          <div>
            <div class="flex items-center gap-3">
              <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
              <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Extended edition</span>
            </div>
            <h1 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
              Extended Podcast Edition
            </h1>
            <p class="mt-3 text-sm leading-6 text-tn-on-surface-variant md:text-base">
              Our extended edition goes deeper. 20 minutes covering more stories with detailed analysis, expert
              context, and actionable takeaways.
            </p>
          </div>

          <div class="mt-6">
            <div class="font-headline text-sm font-bold text-tn-on-surface">What you get</div>
            <ul class="mt-4 space-y-3 text-sm text-tn-on-surface-variant">
              <li class="flex gap-3"><span class="mt-1 h-2 w-2 rounded-full bg-tn-primary" /><span>8–10 stories covered (vs 4 in the daily brief)</span></li>
              <li class="flex gap-3"><span class="mt-1 h-2 w-2 rounded-full bg-tn-primary" /><span>Deeper technical analysis and context</span></li>
              <li class="flex gap-3"><span class="mt-1 h-2 w-2 rounded-full bg-tn-primary" /><span>Actionable recommendations for your team</span></li>
              <li class="flex gap-3"><span class="mt-1 h-2 w-2 rounded-full bg-tn-primary" /><span>Weekly recap edition on Fridays</span></li>
            </ul>
          </div>

          <form class="mt-8 space-y-6" @submit.prevent="submit">
            <div>
              <label class="block font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant" for="extended-email">Email</label>
              <input
                id="extended-email"
                v-model.trim="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                required
                placeholder="you@company.com"
                class="mt-2 w-full rounded-xl bg-tn-surface-high/70 px-4 py-3 text-sm text-tn-on-surface placeholder:text-tn-on-surface-variant ring-1 ring-white/10 focus:outline-none"
              >
              <p v-if="email && !emailValid" class="mt-2 text-xs text-red-200">Please enter a valid email address.</p>
            </div>

            <div>
              <div class="font-headline text-sm font-bold text-tn-on-surface">
                How would you like to receive it?
                <span class="font-normal text-tn-on-surface-variant">(optional)</span>
              </div>
              <div class="mt-3 grid gap-3">
                <label
                  v-for="opt in deliveryOptions"
                  :key="opt.value"
                  class="flex cursor-pointer items-center gap-3 rounded-xl bg-tn-surface-lowest/40 px-4 py-3 text-sm text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest/60"
                >
                  <input
                    v-model="delivery"
                    type="checkbox"
                    :value="opt.value"
                    class="h-4 w-4 rounded border-white/20 bg-black/20 text-tn-primary focus:ring-tn-primary/40"
                  >
                  <span>{{ opt.label }}</span>
                </label>
              </div>
            </div>

            <div
              v-if="errorMessage"
              class="rounded-2xl bg-red-950/20 px-5 py-4 text-sm text-red-200 ring-1 ring-red-500/25"
            >
              {{ errorMessage }}
            </div>

            <button
              type="submit"
              :disabled="loading || !emailValid"
              class="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-4 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span v-if="loading">Submitting…</span>
              <span v-else>Notify me when it launches</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Extended Podcast Edition — ThreatNoir',
  description: "Sign up for ThreatNoir's extended 20-minute podcast with deeper security analysis.",
  ogTitle: 'Extended Podcast Edition — ThreatNoir',
  ogDescription: "Sign up for ThreatNoir's extended 20-minute podcast with deeper security analysis.",
  ogType: 'website'
})

type DeliveryOption = { label: string; value: string }

const deliveryOptions: DeliveryOption[] = [
  { label: 'Email link to audio', value: 'email' },
  { label: 'RSS feed', value: 'rss' },
  { label: 'Spotify', value: 'spotify' },
  { label: 'Apple Podcasts', value: 'apple_podcasts' }
]

const email = ref('')
const delivery = ref<string[]>([])

const loading = ref(false)
const success = ref(false)
const submittedEmail = ref('')
const errorMessage = ref<string | null>(null)

const emailValid = computed(() => {
  const v = (email.value || '').trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
})

function getErrorText(err: unknown): string {
  if (!err) return 'Unknown error.'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message

  const e = err as Record<string, unknown>
  const data = e?.data as Record<string, unknown> | undefined
  const statusMessage = typeof data?.statusMessage === 'string' ? data.statusMessage : null
  const message = typeof e?.message === 'string' ? (e.message as string) : null
  return statusMessage || message || 'Unknown error.'
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as Record<string, unknown>
  const status = e.statusCode ?? e.status
  return typeof status === 'number' ? status : undefined
}

async function submit() {
  errorMessage.value = null
  if (!emailValid.value) {
    errorMessage.value = 'Please enter a valid email address.'
    return
  }

  loading.value = true
  try {
    const res = await $fetch<{ success: boolean; already?: boolean }>('/api/podcast/extended-signup', {
      method: 'POST',
      body: {
        email: email.value.trim(),
        delivery: delivery.value
      }
    })

    submittedEmail.value = email.value.trim()
    if (res.already) {
      errorMessage.value = 'You are already signed up! We will notify you when the extended edition launches.'
    } else {
      success.value = true
    }
  } catch (e: unknown) {
    const status = getErrorStatus(e)
    if (status === 429) {
      errorMessage.value = 'Too many requests, try again later.'
    } else {
      errorMessage.value = getErrorText(e)
    }
  } finally {
    loading.value = false
  }
}
</script>
