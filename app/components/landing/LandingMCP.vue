<template>
  <section ref="root" class="py-16 md:py-24">
    <div class="mx-auto max-w-6xl px-6">
      <div class="grid gap-10 lg:grid-cols-12 lg:items-start">
        <div class="tn-reveal lg:col-span-6" :class="revealed ? 'tn-reveal--in' : ''">
          <div class="flex items-center gap-3">
            <img src="/mcp-icon.svg" alt="" class="h-8 w-8" loading="lazy">
            <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Integrate IOCs into your AI workflow</p>
          </div>
	          <h2 class="mt-4 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
	            MCP Server for {{ site.name }}
          </h2>
          <p class="mt-3 max-w-xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
            Search and query threat indicators directly from Claude Code, VS Code, or any MCP-compatible client.
          </p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              to="/settings"
              class="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
            >
              Get your API key →
            </NuxtLink>
            <NuxtLink
              to="/developer"
              class="inline-flex items-center justify-center rounded-lg bg-tn-surface-high px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-highest"
            >
              Developer docs →
            </NuxtLink>
          </div>
        </div>

        <div
          class="tn-reveal glass-panel relative overflow-hidden rounded-2xl p-6 ring-1 ring-white/10 lg:col-span-6 md:p-8"
          :class="revealed ? 'tn-reveal--in' : ''"
          :style="{ transitionDelay: '120ms' }"
        >
          <div class="pointer-events-none absolute inset-0">
            <div class="absolute inset-0 bg-gradient-to-r from-tn-primary/10 via-transparent to-transparent" />
          </div>

          <div class="relative">
            <div class="flex items-start justify-between gap-3">
              <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">
                .mcp.json
              </div>
              <button
                type="button"
                class="shrink-0 rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                @click="copyToClipboard(mcpConfig)"
              >
                Copy
              </button>
            </div>

            <pre class="mt-4 overflow-x-auto rounded-2xl bg-tn-surface-lowest/60 p-4 font-mono text-sm text-tn-on-surface ring-1 ring-white/10"><code>{{ mcpConfig }}</code></pre>
            <p class="mt-3 text-xs text-tn-on-surface-variant">
              Tip: store your key as an environment variable — you can generate one in Settings → API Keys.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          v-for="(f, idx) in features"
          :key="f.title"
          class="tn-reveal rounded-2xl bg-tn-surface-low/50 p-5 ring-1 ring-white/10 backdrop-blur-md"
          :class="revealed ? 'tn-reveal--in' : ''"
          :style="{ transitionDelay: `${180 + idx * 80}ms` }"
        >
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-tn-surface-lowest/60 ring-1 ring-white/10">
              <UIcon :name="f.icon" class="h-5 w-5 text-tn-primary" />
            </div>
            <div class="min-w-0">
              <div class="font-headline text-sm font-bold text-tn-on-surface">{{ f.title }}</div>
              <div class="mt-0.5 text-xs text-tn-on-surface-variant">{{ f.body }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useScrollReveal } from '~/composables/useScrollReveal'
	import { useToast } from '~/composables/useToast'
	const site = useSiteConfig()

const { el: root, revealed } = useScrollReveal({ rootMargin: '0px 0px -12% 0px' })
	const toast = useToast()

const mcpConfig = `{
  "mcpServers": {
    "threatnoir-iocs": {
      "command": "npx",
      "args": ["threatnoir-mcp-iocs"],
      "env": { "THREATNOIR_API_KEY": "your-key-here" }
    }
  }
}`

const features = [
  {
    title: 'Search IOCs',
    body: 'Query IPs, domains, hashes, CVEs by keyword.',
    icon: 'i-heroicons-magnifying-glass'
  },
  {
    title: 'List by Type',
    body: 'Filter indicators by type: malware, IP, domain, CVE.',
    icon: 'i-heroicons-funnel'
  },
  {
    title: 'Exact Lookup',
    body: 'Find all context for a specific indicator.',
    icon: 'i-heroicons-bolt'
  }
]

async function copyToClipboard(value: string) {
  if (!import.meta.client) return
  const v = (value || '').trim()
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
	    toast.show('Copied')
  } catch {
	    toast.show('Copy failed', 'error')
    window.prompt('Copy config:', v)
  }
}
</script>
