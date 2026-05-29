<template>
  <section class="py-16 md:py-20">
    <div class="mx-auto max-w-6xl px-6">
      <div class="mb-10 text-center md:mb-14">
        <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Who it's for</p>
        <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
          Built for security practitioners who need signal, not noise
        </h2>
	      <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	        Pick your role to see what {{ site.name }} gives you today.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NuxtLink
          v-for="p in personas"
          :key="p.key"
          :to="p.href"
          class="group relative overflow-hidden rounded-2xl bg-tn-surface-low/70 p-6 ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1 hover:ring-tn-primary/40 hover:shadow-[0_8px_30px_rgba(76,215,246,0.12)]"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-tn-primary/10 ring-1 ring-tn-primary/20">
            <UIcon :name="p.icon" class="h-5 w-5 text-tn-primary" />
          </div>

          <h3 class="mt-4 font-headline text-lg font-bold tracking-tight text-tn-on-surface">
            {{ p.title }}
          </h3>

          <p class="mt-2 text-sm leading-6 text-tn-on-surface-variant">
            {{ p.hook }}
          </p>

          <div class="mt-4 flex flex-wrap gap-1.5">
            <span
              v-for="t in p.features"
              :key="t"
              class="inline-flex items-center rounded-full bg-black/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10"
            >
              {{ t }}
            </span>
          </div>

          <div
            class="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-tn-primary opacity-70 transition-opacity group-hover:opacity-100"
          >
            {{ p.cta }}
            <UIcon name="i-heroicons-arrow-right" class="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
	const site = useSiteConfig()
const personas = [
  {
    key: 'soc',
    icon: 'i-heroicons-shield-check',
    title: 'SOC Analysts & Threat Hunters',
    hook: 'Your morning briefing in 5 minutes. IOCs in your Claude workflow. Focus items tell you what to prioritize today.',
    features: ['Daily podcast', 'IOC search', 'MCP server', 'Focus items'],
    cta: 'Start with the podcast',
	    href: '/for-soc'
  },
  {
    key: 'ciso',
    icon: 'i-heroicons-briefcase',
    title: 'Security Leaders & CISOs',
	    hook: 'The weekly brief your board will actually read. Regulation-aware. Awareness Lessons to share with your team.',
	    features: ['Weekly roundup', 'Regulations', 'Awareness Lessons', 'Exec digest'],
    cta: 'Read the weekly brief',
	    href: '/for-leaders'
  },
  {
    key: 'learner',
    icon: 'i-heroicons-academic-cap',
    title: 'Learning Security Pros',
    hook: 'Learn security by what is actually happening right now. Root-cause takeaways from real incidents.',
	    features: ['Awareness Lessons', 'Tips & tricks', 'Resources', 'Podcast'],
	    cta: 'Explore Awareness Lessons',
	    href: '/for-learners'
  },
  {
    key: 'dev',
    icon: 'i-heroicons-code-bracket',
    title: 'Developers & Platform Engineers',
    hook: 'IOCs in your MCP server. Webhooks for your security tooling. APIs to automate lookups.',
    features: ['MCP server', 'REST API', 'Webhooks', 'Discord/TG'],
    cta: 'Read developer docs',
	    href: '/for-developers'
  }
]
</script>

