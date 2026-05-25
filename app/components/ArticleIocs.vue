<template>
	<section class="glass-panel rounded-2xl p-6 md:p-8">
	  <div class="flex items-center gap-3">
	    <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	    <h2 class="font-headline text-lg font-black tracking-tight text-tn-on-surface md:text-xl">Sources &amp; IOCs</h2>
	  </div>
	  <p class="mt-2 max-w-2xl text-sm text-tn-on-surface-variant">
	    Source articles and extracted indicators (defanged where appropriate).
	  </p>

    <div class="mt-5 space-y-5">
	    <article
        v-for="src in normalizedSources"
        :key="src.article_id"
	      class="rounded-2xl border-l-4 border-l-tn-primary/60 bg-tn-surface-lowest/40 p-5 ring-1 ring-white/10"
      >
        <a
          :href="safeHref(src.url)"
          target="_blank"
          rel="noopener noreferrer"
	      class="text-base font-semibold text-tn-on-surface hover:text-white hover:underline hover:decoration-white/20 hover:underline-offset-4"
        >
          {{ src.title || 'Source article' }}
        </a>

	        <div class="mt-5 space-y-4">
          <section v-for="g in groupByType(src.iocs)" :key="g.type">
	            <div class="mb-3 flex flex-wrap items-center gap-2">
	              <span
	                class="inline-flex items-center rounded-full px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest ring-1"
	                :class="typeBadgeClass(g.type)"
	              >
	                {{ typeLabel(g.type) }}
	              </span>
	              <span class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">{{ g.items.length }}</span>
	            </div>

            <ul class="space-y-2">
	              <li
                v-for="(ioc, idx) in g.items"
                :key="`${ioc.type}:${ioc.value}:${idx}`"
	                class="rounded-xl bg-black/20 px-3 py-3 ring-1 ring-white/10"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <!-- CVE -->
	                      <a
                        v-if="ioc.type === 'cve'"
                        :href="nvdHref(ioc.value)"
                        target="_blank"
                        rel="noopener noreferrer"
	                        class="inline-flex items-center rounded-full bg-red-950/20 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-red-200 ring-1 ring-red-500/25 hover:bg-red-950/30"
                      >
                        {{ ioc.value }}
                      </a>

                      <!-- MITRE ATT&CK -->
	                      <a
                        v-else-if="ioc.type === 'mitre_attack'"
                        :href="mitreHref(ioc.value)"
                        target="_blank"
                        rel="noopener noreferrer"
	                        class="inline-flex items-center rounded-full bg-fuchsia-950/20 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-fuchsia-200 ring-1 ring-fuchsia-500/25 hover:bg-fuchsia-950/30"
                      >
                        {{ ioc.value }}
                      </a>

                      <!-- Malware -->
	                      <span v-else-if="ioc.type === 'malware'" class="text-sm font-semibold text-tn-on-surface">
                        {{ ioc.value }}
                      </span>

                      <!-- URL (defanged) -->
	                      <code
                        v-else-if="ioc.type === 'url'"
	                        class="rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-xs text-tn-on-surface ring-1 ring-white/10"
                        :title="ioc.value"
                      >
                        {{ defangUrl(ioc.value) }}
                      </code>

                      <!-- Email (defanged) -->
	                      <code
                        v-else-if="ioc.type === 'email'"
	                        class="rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-xs text-tn-on-surface ring-1 ring-white/10"
                        :title="ioc.value"
                      >
                        {{ defangEmail(ioc.value) }}
                      </code>

                      <!-- Hash / IP / Domain / fallback -->
	                      <code
                        v-else
	                        class="rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-xs text-tn-on-surface ring-1 ring-white/10"
                        :title="ioc.value"
                      >
                        {{ isHashType(ioc.type) ? truncateHash(ioc.value) : ioc.value }}
                      </code>
                    </div>

	                  <div v-if="ioc.context" class="mt-2 text-xs leading-relaxed text-tn-on-surface-variant">
                      {{ ioc.context }}
                    </div>
                  </div>

	                  <button
                    v-if="isHashType(ioc.type)"
                    type="button"
	                    class="shrink-0 rounded-lg bg-tn-surface-lowest/60 px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                    @click="copyValue(ioc.value)"
                  >
                    Copy
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { safeHref } from '~/composables/useSafeHref'
import { useToast } from '~/composables/useToast'

type ReviewSourceIoc = { type: string; value: string; context: string | null }
type ReviewSource = { article_id: string; title: string; url: string; iocs: ReviewSourceIoc[] }

const props = defineProps<{ sources: ReviewSource[] }>()
	const toast = useToast()

const normalizedSources = computed(() => (Array.isArray(props.sources) ? props.sources : []).filter((s) => s && Array.isArray(s.iocs) && s.iocs.length))

function typeLabel(type: string): string {
  const t = (type || '').toLowerCase()
  if (t === 'cve') return 'CVE'
  if (t === 'ip') return 'IP Address'
  if (t === 'domain') return 'Domain'
  if (t === 'hash_md5') return 'MD5'
  if (t === 'hash_sha1') return 'SHA-1'
  if (t === 'hash_sha256') return 'SHA-256'
  if (t === 'url') return 'URL'
  if (t === 'mitre_attack') return 'MITRE ATT&CK'
  if (t === 'email') return 'Email'
  if (t === 'malware') return 'Malware'
  return type
}

function typeBadgeClass(type: string): string {
  const t = (type || '').toLowerCase()
  if (t === 'cve') return 'bg-red-950/20 text-red-200 ring-red-500/25'
  if (t === 'mitre_attack') return 'bg-fuchsia-950/20 text-fuchsia-200 ring-fuchsia-500/25'
  if (t === 'malware') return 'bg-rose-950/20 text-rose-200 ring-rose-500/25'
  if (t === 'ip') return 'bg-sky-950/20 text-sky-200 ring-sky-500/25'
  if (t === 'domain') return 'bg-cyan-950/20 text-cyan-200 ring-cyan-500/25'
  if (t === 'url') return 'bg-emerald-950/20 text-emerald-200 ring-emerald-500/25'
  if (t === 'email') return 'bg-violet-950/20 text-violet-200 ring-violet-500/25'
  if (t.startsWith('hash_')) return 'bg-amber-950/20 text-amber-200 ring-amber-500/25'
  return 'bg-tn-surface-lowest/60 text-tn-on-surface-variant ring-white/10'
}

function typeOrder(type: string): number {
  const order = ['cve', 'mitre_attack', 'malware', 'ip', 'domain', 'url', 'email', 'hash_sha256', 'hash_sha1', 'hash_md5']
  const idx = order.indexOf((type || '').toLowerCase())
  return idx >= 0 ? idx : 999
}

function groupByType(iocs: ReviewSourceIoc[]) {
  const m = new Map<string, ReviewSourceIoc[]>()
  for (const i of Array.isArray(iocs) ? iocs : []) {
    const key = (i?.type || '').toLowerCase() || 'unknown'
    const arr = m.get(key)
    if (arr) arr.push(i)
    else m.set(key, [i])
  }
  return [...m.entries()]
    .sort(([a], [b]) => typeOrder(a) - typeOrder(b) || a.localeCompare(b))
    .map(([type, items]) => ({ type, items }))
}

function isHashType(type: string): boolean {
  const t = (type || '').toLowerCase()
  return t === 'hash_md5' || t === 'hash_sha1' || t === 'hash_sha256'
}

function truncateHash(value: string): string {
  const v = (value || '').trim()
  return v.length <= 12 ? v : `${v.slice(0, 12)}…`
}

function defangUrl(value: string): string {
  const v = (value || '').trim()
  const schemeDefanged = v.replace(/^https:/i, 'hxxps:').replace(/^http:/i, 'hxxp:')
  return schemeDefanged.replaceAll('.', '[.]')
}

function defangEmail(value: string): string {
  return (value || '').trim().replaceAll('@', '[@]')
}

function nvdHref(cve: string): string {
  const v = (cve || '').trim()
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(v)}`
}

function mitreHref(id: string): string {
  const v = (id || '').trim()
  return `https://attack.mitre.org/techniques/${encodeURIComponent(v)}`
}

async function copyValue(value: string) {
  if (!import.meta.client) return
  const v = (value || '').trim()
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
	    toast.show('Copied')
  } catch {
	    toast.show('Copy failed', 'error')
    window.prompt('Copy IOC value:', v)
  }
}
</script>
