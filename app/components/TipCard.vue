<template>
  <article :id="`tip-${tip.id}`" :class="rootClass">
    <!-- Card: AI Prompt (Featured/Wide) -->
    <template v-if="variant === 'ai-featured'">
      <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
        <UIcon name="i-heroicons-cpu-chip" class="h-20 w-20" />
      </div>

      <div>
        <div class="flex items-center gap-3 mb-6">
          <span class="px-2 py-1 rounded bg-cyan-900/30 text-cyan-400 text-[10px] font-bold font-label uppercase tracking-tighter">AI PROMPT</span>
          <span class="text-on-surface-variant text-xs font-label opacity-40">ID: {{ idLabel }}</span>
        </div>

        <h3 class="text-2xl font-bold text-on-surface mb-3 group-hover:text-primary transition-colors">
          <a
            :href="`/tips/${tip.id}`"
            class="hover:underline hover:decoration-outline-variant/30 hover:underline-offset-4"
          >
            {{ tip.title }}
          </a>
        </h3>

        <p class="text-on-surface-variant text-sm mb-6 max-w-xl">
          {{ description }}
        </p>

        <div class="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/10 mb-6 font-mono text-sm leading-relaxed relative">
          <div class="absolute top-3 right-3 text-[10px] text-primary/40 uppercase font-label font-bold">System Role</div>
          <span class="text-primary">"{{ systemRoleText }}"</span>
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-outline-variant/10 pt-6">
        <div class="flex -space-x-2">
          <div class="w-6 h-6 rounded-full border border-background bg-slate-800 flex items-center justify-center text-[10px] font-bold">
            {{ initials }}
          </div>
          <div class="w-6 h-6 rounded-full border border-background bg-slate-700 flex items-center justify-center text-[10px] font-bold">
            TN
          </div>
        </div>
        <div class="flex gap-4">
          <button
            type="button"
            class="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all text-xs font-label"
            @click.stop="copyTip"
          >
            <UIcon name="i-heroicons-clipboard-document" class="h-4 w-4" /> Copy
          </button>
          <button
            type="button"
            class="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all text-xs font-label"
            @click.stop="shareTip"
          >
            <UIcon name="i-heroicons-share" class="h-4 w-4" /> Share
          </button>
        </div>
      </div>
    </template>

    <!-- Card: Regulation (Compact) -->
    <template v-else-if="variant === 'regulation'">
      <div>
        <div class="flex items-center gap-3 mb-6">
          <span class="px-2 py-1 rounded bg-purple-900/30 text-purple-400 text-[10px] font-bold font-label uppercase tracking-tighter">REGULATION</span>
          <UIcon name="i-heroicons-shield-check" class="h-5 w-5 text-purple-400/50" />
        </div>

        <h3 class="text-xl font-bold text-on-surface mb-3">
          <a :href="`/tips/${tip.id}`" class="hover:underline hover:decoration-outline-variant/30 hover:underline-offset-4">
            {{ tip.title }}
          </a>
        </h3>

        <p class="text-on-surface-variant text-sm mb-6 leading-relaxed">
          {{ description }}
        </p>

        <div class="space-y-3">
          <div
            v-for="(item, idx) in checklistItems"
            :key="`${tip.id}-check-${idx}`"
            class="flex items-center gap-3 text-xs text-on-surface-variant"
            :class="idx >= 2 ? 'opacity-40' : ''"
          >
            <UIcon
              :name="idx < 2 ? 'i-heroicons-check-circle-solid' : 'i-heroicons-minus-circle'"
              class="h-4 w-4 shrink-0"
              :class="idx < 2 ? 'text-primary' : ''"
            />
            {{ item }}
          </div>
        </div>
      </div>

      <div class="mt-8">
        <button
          type="button"
          class="text-primary text-xs font-bold font-label uppercase tracking-widest hover:underline flex items-center gap-2"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Collapse' : 'View Checklist' }}
          <UIcon :name="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-arrow-right'" class="h-3 w-3" />
        </button>
      </div>

      <div v-if="expanded" class="mt-6 border-t border-outline-variant/10 pt-6">
        <div class="tip-body text-sm text-on-surface-variant leading-relaxed" v-html="renderedBody" />
        <div class="mt-4 pt-4 border-t border-outline-variant/10">
          <a
            :href="`/tips/${tip.id}`"
            class="text-primary text-xs font-bold font-label uppercase tracking-widest hover:underline inline-flex items-center gap-2"
          >
            Open full page <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3 w-3" />
          </a>
        </div>
      </div>
    </template>

    <!-- Card: Ops Tactic (Square/Dense) -->
    <template v-else-if="variant === 'ops'">
      <div class="flex items-center gap-3 mb-6">
        <span class="px-2 py-1 rounded bg-orange-900/30 text-orange-400 text-[10px] font-bold font-label uppercase tracking-tighter">OPS TACTIC</span>
      </div>

      <h3 class="text-xl font-bold text-on-surface mb-3">
        <a :href="`/tips/${tip.id}`" class="hover:underline hover:decoration-outline-variant/30 hover:underline-offset-4">
          {{ tip.title }}
        </a>
      </h3>

      <p class="text-on-surface-variant text-sm mb-6 leading-relaxed">
        {{ description }}
      </p>

      <div class="mt-auto grid grid-cols-2 gap-4">
        <div class="p-3 bg-surface-container-lowest rounded border border-outline-variant/10">
          <div class="text-[10px] text-on-surface-variant uppercase font-label mb-1">Risk Level</div>
          <div class="text-error font-bold text-xs uppercase">{{ riskLevel }}</div>
        </div>
        <div class="p-3 bg-surface-container-lowest rounded border border-outline-variant/10">
          <div class="text-[10px] text-on-surface-variant uppercase font-label mb-1">Impact</div>
          <div class="text-primary font-bold text-xs uppercase">{{ impact }}</div>
        </div>
      </div>

      <div class="mt-6">
        <button
          type="button"
          class="text-primary text-xs font-bold font-label uppercase tracking-widest hover:underline flex items-center gap-2"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Collapse' : 'View' }}
          <UIcon :name="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-arrow-right'" class="h-3 w-3" />
        </button>
      </div>

      <div v-if="expanded" class="mt-6 border-t border-outline-variant/10 pt-6">
        <div class="tip-body text-sm text-on-surface-variant leading-relaxed" v-html="renderedBody" />
        <div class="mt-4 pt-4 border-t border-outline-variant/10">
          <a
            :href="`/tips/${tip.id}`"
            class="text-primary text-xs font-bold font-label uppercase tracking-widest hover:underline inline-flex items-center gap-2"
          >
            Open full page <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3 w-3" />
          </a>
        </div>
      </div>
    </template>

    <!-- Card: AI Prompt (Secondary) -->
    <template v-else>
      <div class="flex items-center gap-3 mb-6">
        <span class="px-2 py-1 rounded bg-cyan-900/30 text-cyan-400 text-[10px] font-bold font-label uppercase tracking-tighter">AI PROMPT</span>
      </div>

      <h3 class="text-xl font-bold text-on-surface mb-3">
        <a :href="`/tips/${tip.id}`" class="hover:underline hover:decoration-outline-variant/30 hover:underline-offset-4">
          {{ tip.title }}
        </a>
      </h3>

      <p class="text-on-surface-variant text-sm mb-6 leading-relaxed">
        {{ description }}
      </p>

      <div class="p-4 bg-surface-container-lowest rounded-lg font-mono text-[11px] text-on-surface-variant/80 italic">
        "{{ promptPreview }}"
      </div>

      <div class="mt-6 flex justify-between items-center">
        <button
          type="button"
          class="text-primary text-xs font-bold font-label uppercase tracking-widest hover:underline flex items-center gap-2"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Collapse' : 'View' }}
          <UIcon :name="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-arrow-right'" class="h-3 w-3" />
        </button>
        <UIcon name="i-heroicons-bookmark" class="h-5 w-5 text-on-surface-variant cursor-pointer hover:text-primary" />
      </div>

      <div v-if="expanded" class="mt-6 border-t border-outline-variant/10 pt-6">
        <div class="tip-body text-sm text-on-surface-variant leading-relaxed" v-html="renderedBody" />
        <div class="mt-4 pt-4 border-t border-outline-variant/10">
          <a
            :href="`/tips/${tip.id}`"
            class="text-primary text-xs font-bold font-label uppercase tracking-widest hover:underline inline-flex items-center gap-2"
          >
            Open full page <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3 w-3" />
          </a>
        </div>
      </div>
    </template>
  </article>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { useToast } from '~/composables/useToast'
	const site = useSiteConfig()

type TipCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
}

export type TipItem = {
  id: string
  title: string
  body: string
  tags: string[]
  author_name: string
  featured: boolean
  created_at: string
  updated_at: string
  category: TipCategory | null
}

const props = defineProps<{ tip: TipItem }>()
	const toast = useToast()

const expanded = ref(false)

const categoryColor = computed(() => String(props.tip.category?.color || '').toLowerCase())

const variant = computed(() => {
  if (props.tip.featured && categoryColor.value === 'cyan') return 'ai-featured'
  if (categoryColor.value === 'purple') return 'regulation'
  if (categoryColor.value === 'orange') return 'ops'
  return 'ai'
})

const rootClass = computed(() => {
  if (variant.value === 'ai-featured') {
    return 'group relative flex flex-col justify-between p-8 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all duration-300'
  }

  if (variant.value === 'regulation') {
    return 'p-8 rounded-xl bg-surface-container-low border border-outline-variant/5 flex flex-col justify-between hover:bg-surface-container transition-all'
  }

  if (variant.value === 'ops') {
    return 'p-8 rounded-xl bg-surface-container-low border border-outline-variant/5 flex flex-col hover:bg-surface-container transition-all'
  }

  return 'p-8 rounded-xl bg-surface-container-low border border-outline-variant/5 flex flex-col hover:bg-surface-container transition-all'
})

const idLabel = computed(() => {
  const raw = String(props.tip.id || '').trim()
  return raw ? raw.toUpperCase() : 'P-UNKNOWN'
})

const initials = computed(() => {
  const name = String(props.tip.author_name || '').trim()
  if (!name) return 'TN'
  const parts = name.split(/\s+/g).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '')
  const out = letters.join('')
  return out || 'TN'
})

const description = computed(() => makeExcerpt(props.tip.body || '', 220))

const systemRoleText = computed(() => {
  const raw = String(props.tip.body || '').trim()
  if (!raw) return 'Analyze the provided input and identify anomalies.'

  const clean = raw
    .replace(/```[^`]*```/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return 'Analyze the provided input and identify anomalies.'
  return clean.length <= 220 ? clean : `${clean.slice(0, 220).trim()}…`
})

const promptPreview = computed(() => {
  const raw = String(props.tip.body || '').trim()
  const clean = raw
    .replace(/```[^`]*```/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return '…'
  return clean.length <= 90 ? clean : `${clean.slice(0, 90).trim()}…`
})

const checklistItems = computed(() => {
  const fallback = ['Strategic intel source mapping', 'Dissemination latency logs', 'Vendor risk validation']
  const tags = Array.isArray(props.tip.tags) ? props.tip.tags : []
  const items = tags.map((t) => String(t || '').trim()).filter(Boolean)
  const picked = (items.length ? items : fallback).slice(0, 3)
  return picked.length ? picked : fallback
})

const riskLevel = computed(() => {
  const tags = Array.isArray(props.tip.tags) ? props.tip.tags : []
  const lower = tags.map((t) => String(t || '').toLowerCase())
  if (lower.some((t) => t.includes('critical'))) return 'Critical'
  if (lower.some((t) => t.includes('high'))) return 'High'
  if (lower.some((t) => t.includes('medium'))) return 'Medium'
  if (lower.some((t) => t.includes('low'))) return 'Low'
  return 'Critical'
})

const impact = computed(() => {
  const tags = Array.isArray(props.tip.tags) ? props.tip.tags : []
  const lower = tags.map((t) => String(t || '').toLowerCase())
  if (lower.some((t) => t.includes('high'))) return 'High'
  if (lower.some((t) => t.includes('medium'))) return 'Medium'
  if (lower.some((t) => t.includes('low'))) return 'Low'
  return 'High'
})

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function copyTip() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText((props.tip.body || '').trim() || props.tip.title)
	    toast.show('Copied')
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
      copiedTimer = null
    }, 1200)
  } catch (e) {
	    toast.show('Copy failed', 'error')
    console.warn('[TipCard] copy failed:', e)
  }
}

async function shareTip() {
  if (!import.meta.client) return

  const url = `${window.location.origin}/tips/${encodeURIComponent(props.tip.id)}`
	  const title = (props.tip.title || '').trim() || `${site.name} tip`

  try {
    if (navigator.share) {
      await navigator.share({ title, url })
      return
    }
  } catch {
    // ignore and fall back to clipboard
  }

  try {
    await navigator.clipboard.writeText(url)
	    toast.show('Link copied')
  } catch (e) {
	    toast.show('Copy failed', 'error')
    console.warn('[TipCard] share fallback copy failed:', e)
  }
}

const renderedBody = computed(() => {
  const src = props.tip.body || ''
  if (!src.trim()) return ''
  const renderer = new marked.Renderer()
  renderer.link = ({ href, text }) => {
    const safe = (href || '').replace(/"/g, '&quot;')
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`
  }
  renderer.html = () => ''
  return marked.parse(src, { renderer, gfm: true }) as string
})

function makeExcerpt(src: string, maxLen: number) {
  const raw = (src || '')
    .replace(/```[^`]*```/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#_*`>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw) return '—'
  return raw.length <= maxLen ? raw : `${raw.slice(0, maxLen).trim()}…`
}
</script>

<style scoped>
.tip-body :deep(h1),
.tip-body :deep(h2),
.tip-body :deep(h3) {
  color: white;
  font-weight: 700;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
.tip-body :deep(p) { margin: 0.5rem 0; }
.tip-body :deep(ul),
.tip-body :deep(ol) { padding-left: 1.25rem; margin: 0.5rem 0; }
.tip-body :deep(li) { margin: 0.25rem 0; }
.tip-body :deep(a) { color: var(--color-tn-primary, #4cd7f6); text-decoration: underline; }
.tip-body :deep(strong) { color: white; }
.tip-body :deep(code) { font-size: 0.9em; background: rgba(0,0,0,0.25); padding: 0.15em 0.35em; border-radius: 0.25rem; }
</style>
