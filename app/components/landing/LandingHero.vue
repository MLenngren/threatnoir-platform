<template>
  <section class="relative overflow-hidden">
    <div class="pointer-events-none absolute inset-0 grid-bg">
      <div class="absolute inset-0 bg-gradient-to-b from-transparent via-tn-surface/60 to-tn-surface" />
      <div class="absolute -top-28 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-b from-tn-primary/12 to-transparent blur-3xl" />
    </div>

    <div class="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div class="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
        <div class="lg:col-span-7">
          <div class="inline-flex items-center gap-2 rounded-full bg-tn-primary/10 px-3 py-1 ring-1 ring-tn-primary/20">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-tn-primary opacity-70" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-tn-primary" />
            </span>
            <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Live global ops</span>
            <span class="text-slate-600">•</span>
            <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
              1000+ sources monitored
            </span>
          </div>

          <h1 class="mt-8 text-balance font-headline text-5xl font-black leading-[0.9] tracking-tight text-tn-on-surface md:text-7xl">
            Security <span class="text-tn-primary">intelligence,</span> curated for practitioners.
          </h1>

	          <p class="mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-tn-on-surface md:text-base">
	            ThreatNoir is a daily-updated security intelligence platform with curated articles, real-time IOCs, podcasts, and weekly briefs for SOC analysts, security leaders, and engineers.
	          </p>

	          <p class="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-tn-on-surface-variant">
            Your daily security briefing in under 5 minutes. We score every story for relevance, link back to the original source, and keep your signal clean.
          </p>

          <div class="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <NuxtLink
              to="/podcast"
              class="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black transition-transform hover:-translate-y-0.5"
            >
              Listen to Today’s Briefing
            </NuxtLink>

            <NuxtLink
              to="/subscribe"
              class="inline-flex items-center justify-center rounded-lg bg-tn-surface-high px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-highest"
            >
              Get Personalized Alerts
            </NuxtLink>
          </div>

	          <div class="mt-6 w-full max-w-md">
	            <div
	              v-if="!submitted"
	              class="rounded-2xl bg-tn-surface-low/70 p-4 backdrop-blur-md ring-1 ring-white/10"
	            >
	              <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">
	                Get the daily brief. Free during beta.
	              </p>

	              <form
	                class="mt-3 flex flex-col gap-2 sm:flex-row"
	                aria-label="Subscribe via email"
	                @submit.prevent="submitEmail"
	              >
	                <label class="sr-only" for="landing-hero-email">Email address</label>
	                <input
	                  id="landing-hero-email"
	                  v-model="email"
	                  type="email"
	                  inputmode="email"
	                  autocomplete="email"
	                  required
	                  placeholder="you@company.com"
	                  class="flex-1 rounded-lg bg-tn-surface-lowest/60 px-4 py-2.5 text-sm text-tn-on-surface placeholder:text-tn-on-surface-variant ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/25"
	                  :disabled="submitting"
	                  :aria-invalid="!!error"
	                  :aria-describedby="error ? 'landing-hero-email-error' : 'landing-hero-email-help'"
	                >
	                <button
	                  type="submit"
	                  class="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-2.5 text-sm font-bold text-black hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
	                  :disabled="submitting"
	                >
	                  <span v-if="submitting">Subscribing…</span>
	                  <span v-else>Subscribe</span>
	                </button>
	              </form>

	              <p
	                v-if="error"
	                id="landing-hero-email-error"
	                class="mt-2 text-xs text-red-300"
	                role="alert"
	              >
	                {{ error }}
	              </p>
	              <p v-else id="landing-hero-email-help" class="mt-2 text-xs text-tn-on-surface-variant">
	                No spam. Unsubscribe anytime.
	              </p>
	            </div>
	            <div v-else class="rounded-2xl bg-tn-primary/10 p-4 ring-1 ring-tn-primary/30">
	              <p class="text-sm font-semibold text-tn-on-surface">Thanks! Check your inbox to confirm.</p>
	              <p class="mt-1 text-xs text-tn-on-surface-variant">We’ll send you daily briefings and the weekly roundup.</p>
	            </div>
	          </div>

          <p class="mt-6 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
            New episodes daily at <span class="font-mono text-tn-on-surface">07:00</span> and
            <span class="font-mono text-tn-on-surface">16:00</span> UTC.
          </p>
        </div>

        <div class="lg:col-span-5">
          <div class="glass-panel relative overflow-hidden rounded-xl p-6">
            <div class="absolute right-0 top-0 p-5 opacity-20">
              <span class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-tn-primary/10 text-tn-primary ring-1 ring-tn-primary/20">
                <UIcon name="i-heroicons-shield-check" class="h-6 w-6" />
              </span>
            </div>

            <h3 class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Active threat vector</h3>

            <div class="mt-6 space-y-4">
              <div v-for="a in latest" :key="a.id" class="rounded-lg bg-tn-surface-lowest p-4 ring-1 ring-white/5">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-[10px] font-bold uppercase tracking-tight text-tn-primary">[signal]</span>
                      <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ timeLabelFor(a) }}</span>
                    </div>
                    <a
                      :href="safeHref(a.url)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="mt-2 block text-pretty text-sm font-semibold leading-snug text-tn-on-surface hover:text-tn-primary"
                    >
                      {{ a.title }}
                    </a>
                  </div>

                  <UIcon name="i-heroicons-arrow-up-right" class="mt-1 h-4 w-4 shrink-0 text-tn-on-surface-variant" />
                </div>
              </div>

              <div v-if="latest.length === 0" class="rounded-lg bg-tn-surface-lowest p-4 ring-1 ring-white/5">
                <p class="text-sm text-tn-on-surface-variant">No approved articles yet.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'

type HeroArticle = {
  id: string
  title: string
  url: string
  published_at: string | null
  ingested_at: string | null
}

const supabase = useSupabaseClient()

const { data: latestData } = await useAsyncData<HeroArticle[]>('landing-latest-articles', async () => {
  const { data, error } = await supabase
    .from('articles')
    .select('id,title,url,published_at,ingested_at')
    .eq('status', 'approved')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('ingested_at', { ascending: false })
    .limit(2)

  if (error) {
    console.warn('[LandingHero] latest articles query failed:', error.message)
    return []
  }

  return (data ?? []) as HeroArticle[]
})

const latest = computed(() => (Array.isArray(latestData.value) ? latestData.value : []))

const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

async function submitEmail() {
  const e = email.value.trim()
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    error.value = 'Please enter a valid email'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    await $fetch('/api/subscribe', {
      method: 'POST',
      body: {
        email: e,
        preferences: { all: true },
        source: 'landing_hero'
      }
    })
    submitted.value = true
  } catch (e: unknown) {
    const err = e as Record<string, unknown> | null
    const data = (err && typeof err === 'object' ? (err.data as Record<string, unknown> | undefined) : undefined)
    const msg = typeof data?.statusMessage === 'string' ? data.statusMessage : null
    error.value = msg || 'Something went wrong. Try again.'
  } finally {
    submitting.value = false
  }
}

function timeLabelFor(a: HeroArticle): string {
  const raw = a.published_at || a.ingested_at
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
}
</script>
