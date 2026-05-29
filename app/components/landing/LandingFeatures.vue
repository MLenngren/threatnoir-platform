<template>
  <section ref="root" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-6">
      <div class="flex items-end justify-between gap-6">
        <div>
	          <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Command center</p>
	          <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
	            Built for signal
	          </h2>
	          <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
		            {{ site.name }} is designed to compress the threat landscape into something you can act on—fast.
	          </p>
        </div>
      </div>

      <div class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="(f, idx) in features"
          :key="f.title"
	          class="tn-reveal glass-panel relative rounded-2xl p-6"
          :class="revealed ? 'tn-reveal--in' : ''"
          :style="{ transitionDelay: `${idx * 90}ms` }"
        >
	          <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-tn-primary/35 to-transparent" />

          <div class="flex items-start gap-3">
	            <div class="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-tn-surface-lowest/60 text-tn-primary ring-1 ring-white/10">
              <span aria-hidden="true" class="[&>svg]:h-5 [&>svg]:w-5">
                <svg
                  v-if="f.icon === 'filter'"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 5h16l-6.5 7.5V19l-3-1.6v-4.9L4 5Z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>

                <svg
                  v-else-if="f.icon === 'link'"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M10.5 13.5l3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path
                    d="M8.3 15.7l-1.6 1.6a4 4 0 0 1-5.7-5.7l1.6-1.6"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                  <path
                    d="M15.7 8.3l1.6-1.6a4 4 0 0 1 5.7 5.7l-1.6 1.6"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                  <path
                    d="M7.9 12.1a4 4 0 0 1 0-5.7l.8-.8"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    opacity="0.7"
                  />
                  <path
                    d="M16.1 11.9a4 4 0 0 1 0 5.7l-.8.8"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    opacity="0.7"
                  />
                </svg>

                <svg
                  v-else-if="f.icon === 'bell'"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Z"
                    fill="currentColor"
                    opacity="0.9"
                  />
                  <path
                    d="M18 16H6c1.2-1.2 2-2.6 2-4.5V10a4 4 0 0 1 8 0v1.5c0 1.9.8 3.3 2 4.5Z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                </svg>

                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M7 12a5 5 0 0 1 10 0v4a5 5 0 0 1-10 0v-4Z" stroke="currentColor" stroke-width="1.6" />
                  <path d="M12 21v-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  <path
                    d="M9 9V6.6A3 3 0 0 1 12 3.6a3 3 0 0 1 3 3V9"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
            </div>
            <div class="min-w-0">
	              <h3 class="text-sm font-semibold text-tn-on-surface">{{ f.title }}</h3>
	              <p class="mt-2 text-sm leading-6 text-tn-on-surface-variant">
                {{ f.description }}
              </p>
            </div>
          </div>
        </article>
      </div>

      <div
	        class="tn-reveal glass-panel mt-12 grid grid-cols-2 gap-4 rounded-2xl p-6 md:grid-cols-4"
        :class="revealed ? 'tn-reveal--in' : ''"
        :style="{ transitionDelay: '420ms' }"
      >
        <div v-for="s in stats" :key="s.k" class="min-w-0">
	          <div class="font-headline text-lg font-black tracking-tight text-tn-on-surface">{{ s.k }}</div>
	          <div class="mt-1 font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ s.v }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useScrollReveal } from '~/composables/useScrollReveal'
	const site = useSiteConfig()

const { el: root, revealed } = useScrollReveal({ rootMargin: '0px 0px -12% 0px' })

const features = [
  {
    title: 'Curated, Not Aggregated',
    description:
      'AI-powered filtering across 1000+ security news sources. Every article scored for relevance. We cut the noise so you don’t have to.',
    icon: 'filter'
  },
  {
    title: 'Source-Referenced',
    description:
      'Every story traces back to the original source. IoCs extracted and attributed. Regulation and jurisdiction tagged for compliance teams.',
    icon: 'link'
  },
  {
    title: 'Personalized Alerts',
    description:
      'Subscribe to the topics you care about. Get notified via email, Discord, Telegram, or webhook. Only what matters to you.',
    icon: 'bell'
  },
  {
    title: 'Daily Podcast',
    description:
	      'The easiest way to stay security-aware. Morning and afternoon conversational briefings. Five minutes to know what matters. Listen while you commute.',
    icon: 'mic'
  }
] as const

const stats = [
  { k: '15+', v: 'Sources monitored' },
  { k: '30+', v: 'Regulations tracked' },
  { k: '2', v: 'Daily podcasts' },
  { k: '5', v: 'Notification channels' }
] as const
</script>
