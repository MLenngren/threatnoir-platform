<template>
  <section ref="root" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-6">
      <div
        class="tn-reveal glass-panel relative overflow-hidden rounded-2xl p-8 md:p-10"
        :class="revealed ? 'tn-reveal--in' : ''"
      >
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute inset-0 bg-gradient-to-r from-tn-primary/10 via-transparent to-transparent" />
        </div>

        <div class="relative grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div class="lg:col-span-7">
            <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Personalized alerting</p>
            <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
              Stay ahead of the threat landscape.
            </h2>
            <p class="mt-4 max-w-xl text-pretty text-sm leading-6 text-tn-on-surface-variant md:text-base">
              Subscribe for personalized security intelligence delivered to your preferred channel.
            </p>

            <div class="mt-8 grid gap-3 sm:grid-cols-2">
              <div class="flex items-start gap-3 rounded-xl bg-tn-surface-lowest/60 p-4 ring-1 ring-white/5">
                <UIcon name="i-heroicons-bolt" class="mt-0.5 h-5 w-5 text-tn-primary" />
                <div>
                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface">Fast briefings</div>
                  <div class="mt-1 text-sm text-tn-on-surface-variant">Daily summaries in minutes.</div>
                </div>
              </div>
              <div class="flex items-start gap-3 rounded-xl bg-tn-surface-lowest/60 p-4 ring-1 ring-white/5">
                <UIcon name="i-heroicons-shield-exclamation" class="mt-0.5 h-5 w-5 text-tn-primary" />
                <div>
                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface">Signal scoring</div>
                  <div class="mt-1 text-sm text-tn-on-surface-variant">Relevance-ranked intelligence.</div>
                </div>
              </div>
              <div class="flex items-start gap-3 rounded-xl bg-tn-surface-lowest/60 p-4 ring-1 ring-white/5">
                <UIcon name="i-heroicons-link" class="mt-0.5 h-5 w-5 text-tn-primary" />
                <div>
                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface">Source-backed</div>
                  <div class="mt-1 text-sm text-tn-on-surface-variant">Original URLs on every item.</div>
                </div>
              </div>
              <div class="flex items-start gap-3 rounded-xl bg-tn-surface-lowest/60 p-4 ring-1 ring-white/5">
                <UIcon name="i-heroicons-funnel" class="mt-0.5 h-5 w-5 text-tn-primary" />
                <div>
                  <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface">Custom filters</div>
                  <div class="mt-1 text-sm text-tn-on-surface-variant">Tune categories to your team.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-5">
            <div class="rounded-2xl bg-tn-surface-lowest/60 p-6 ring-1 ring-white/10">
              <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Subscribe</p>
              <p class="mt-2 text-sm text-tn-on-surface-variant">Enter your email to configure alerts.</p>

              <form class="mt-6 space-y-3" @submit.prevent="onSubmit">
                <input
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  placeholder="you@company.com"
                  class="w-full rounded-lg bg-tn-surface-high px-4 py-3 text-sm text-tn-on-surface placeholder:text-tn-on-surface-variant ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-tn-primary/40"
                  required
                >

                <button
                  type="submit"
                  class="w-full rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
                >
                  Continue
                </button>

                <NuxtLink
                  to="/feed"
                  class="block text-center font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary"
                >
                  Browse the archive
                </NuxtLink>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useScrollReveal } from '~/composables/useScrollReveal'

const { el: root, revealed } = useScrollReveal({ rootMargin: '0px 0px -12% 0px' })

const email = ref('')

async function onSubmit() {
  const q = email.value.trim()
  await navigateTo(q ? `/subscribe?email=${encodeURIComponent(q)}` : '/subscribe')
}
</script>
