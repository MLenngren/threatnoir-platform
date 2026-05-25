<template>
  <main class="grid-bg py-10">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Hero -->
      <section class="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-10">
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-tn-primary/10 blur-3xl" />
          <div class="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-tn-primary/10 blur-3xl" />
        </div>

        <div class="relative">
          <div class="flex items-center gap-3">
            <img src="/mcp-icon.svg" alt="" class="h-10 w-10" loading="lazy">
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Developer Portal</div>
	            <span class="h-1 w-1 rounded-full bg-white/15" />
	            <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
	              For developers
	            </span>
          </div>
          <h1 class="mt-4 text-balance font-headline text-3xl font-black uppercase tracking-tight text-tn-on-surface md:text-5xl">
            Integrate ThreatNoir IOCs into your security workflow
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
            Use the ThreatNoir MCP server for AI tools, or call the IOC REST API directly.
          </p>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <NuxtLink
              to="/settings"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
            >
              Generate API key →
            </NuxtLink>
            <NuxtLink
              to="/iocs"
              class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
            >
              Explore IOCs →
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Getting started -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Getting started</h2>
        <ol class="mt-4 space-y-3 text-sm text-tn-on-surface-variant">
          <li class="flex gap-3"><span class="font-mono text-tn-on-surface">1.</span> Create an account and sign in.</li>
          <li class="flex gap-3"><span class="font-mono text-tn-on-surface">2.</span> Go to <span class="text-tn-on-surface">Settings → API Keys</span>.</li>
          <li class="flex gap-3"><span class="font-mono text-tn-on-surface">3.</span> Generate a new API key.</li>
          <li class="flex gap-3"><span class="font-mono text-tn-on-surface">4.</span> Install the MCP server (recommended) or use the REST API.</li>
        </ol>
      </section>

      <!-- Installation -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Installation</h2>
            <p class="mt-1 text-sm text-tn-on-surface-variant">Use <span class="font-mono">npx</span> or add to your MCP config.</p>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            <div class="flex items-start justify-between gap-3">
              <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Terminal</div>
              <button
                type="button"
                class="shrink-0 rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                @click="copyToClipboard(installSnippet)"
              >
                Copy
              </button>
            </div>
            <pre class="mt-3 overflow-x-auto rounded-2xl bg-tn-surface-lowest/60 p-4 font-mono text-sm text-tn-on-surface ring-1 ring-white/10"><code>{{ installSnippet }}</code></pre>
          </div>

          <div class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            <div class="flex items-start justify-between gap-3">
              <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">.mcp.json</div>
              <button
                type="button"
                class="shrink-0 rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                @click="copyToClipboard(mcpConfig)"
              >
                Copy
              </button>
            </div>
            <pre class="mt-3 overflow-x-auto rounded-2xl bg-tn-surface-lowest/60 p-4 font-mono text-sm text-tn-on-surface ring-1 ring-white/10"><code>{{ mcpConfig }}</code></pre>
            <p class="mt-3 text-xs text-tn-on-surface-variant">Set <span class="font-mono">THREATNOIR_API_KEY</span> to your generated key.</p>
          </div>
        </div>
      </section>

      <!-- Available tools -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Available tools</h2>
        <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article v-for="t in tools" :key="t.name" class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="font-mono text-sm text-tn-primary">{{ t.name }}</div>
            <p class="mt-2 text-sm text-tn-on-surface-variant">{{ t.desc }}</p>
            <div class="mt-4">
              <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Params</div>
              <ul class="mt-2 space-y-1 text-xs text-tn-on-surface-variant">
                <li v-for="p in t.params" :key="p" class="font-mono">{{ p }}</li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <!-- IOC types -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">IOC types</h2>
            <p class="mt-1 text-sm text-tn-on-surface-variant">Use these values for <span class="font-mono">type</span> filters.</p>
          </div>
        </div>

        <div class="mt-5 overflow-x-auto">
          <table class="w-full min-w-[560px] text-left text-sm">
            <thead class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">
              <tr class="border-b border-white/10">
                <th class="px-2 py-2">Type</th>
                <th class="px-2 py-2">Example</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in iocTypes" :key="row.type" class="border-b border-white/10 hover:bg-white/[0.03]">
                <td class="px-2 py-3 font-mono text-xs text-tn-on-surface">{{ row.type }}</td>
                <td class="px-2 py-3 font-mono text-xs text-tn-on-surface-variant">{{ row.example }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Rate limits + REST API -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Rate limits</h2>
        <ul class="mt-4 space-y-2 text-sm text-tn-on-surface-variant">
          <li><span class="font-mono text-tn-on-surface">100</span> requests per minute per API key.</li>
          <li><span class="font-mono text-tn-on-surface">30</span> requests per minute for unauthenticated access (list only).</li>
        </ul>

        <div class="mt-8">
          <h3 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">REST API</h3>
          <p class="mt-2 text-sm text-tn-on-surface-variant">
            Use <span class="font-mono">Authorization: Bearer tn_live_your_key</span> for authenticated endpoints.
          </p>

	          <div class="mt-4 text-sm text-tn-on-surface-variant">
	            <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">API specification</div>
	            <ul class="mt-2 space-y-1">
	              <li>
	                <a href="/api/openapi.json" class="text-tn-primary hover:underline" target="_blank" rel="noopener noreferrer">OpenAPI 3.1 spec</a>
	              </li>
	              <li>
	                <a href="/.well-known/ai-plugin.json" class="text-tn-primary hover:underline" target="_blank" rel="noopener noreferrer">AI plugin manifest</a>
	              </li>
	              <li>
	                <a href="/downloads/threatnoir-skill/skill.md" class="text-tn-primary hover:underline" target="_blank" rel="noopener noreferrer">Claude Code skill</a>
	                <span class="ml-1 text-[10px] text-tn-on-surface-variant">(copy to ~/.claude/skills/threatnoir/)</span>
	              </li>
	            </ul>
	          </div>

          <div class="mt-4 rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            <div class="flex items-start justify-between gap-3">
              <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Examples</div>
              <button
                type="button"
                class="shrink-0 rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
                @click="copyToClipboard(restExamples)"
              >
                Copy
              </button>
            </div>
            <pre class="mt-3 overflow-x-auto rounded-2xl bg-tn-surface-lowest/60 p-4 font-mono text-sm text-tn-on-surface ring-1 ring-white/10"><code>{{ restExamples }}</code></pre>
          </div>
        </div>
      </section>

	      <!-- Code examples -->
	      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
	        <div class="flex flex-wrap items-start justify-between gap-4">
	          <div>
	            <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Code examples</h2>
	            <p class="mt-2 text-sm text-tn-on-surface-variant">
	              Copy‑paste examples for all endpoints. Full schema available in the
	              <a href="/api/openapi.json" target="_blank" rel="noreferrer noopener" class="text-tn-primary hover:underline">OpenAPI spec</a>.
	            </p>
	          </div>
	        </div>

	        <div class="mt-6 overflow-x-auto">
	          <table class="w-full min-w-[680px] text-left text-sm">
	            <thead class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">
	              <tr class="border-b border-white/10">
	                <th class="px-2 py-2">Tier</th>
	                <th class="px-2 py-2">Search</th>
	                <th class="px-2 py-2">List</th>
	                <th class="px-2 py-2">Limit</th>
	              </tr>
	            </thead>
	            <tbody>
	              <tr v-for="row in rateLimitRows" :key="row.tier" class="border-b border-white/10 hover:bg-white/[0.03]">
	                <td class="px-2 py-3 font-mono text-xs text-tn-on-surface">{{ row.tier }}</td>
	                <td class="px-2 py-3 font-mono text-xs text-tn-on-surface-variant">{{ row.search }}</td>
	                <td class="px-2 py-3 font-mono text-xs text-tn-on-surface-variant">{{ row.list }}</td>
	                <td class="px-2 py-3 font-mono text-xs text-tn-on-surface-variant">{{ row.limit }}</td>
	              </tr>
	            </tbody>
	          </table>
	        </div>

	        <div class="mt-8 flex flex-wrap gap-2 border-b border-white/10">
	          <button
	            v-for="tab in codeExampleTabs"
	            :key="tab"
	            type="button"
	            class="-mb-px rounded-t-xl border-b-2 px-4 py-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] transition"
	            :class="activeCodeTab === tab
	              ? 'border-[#4cd7f6] text-tn-on-surface'
	              : 'border-transparent text-tn-on-surface-variant hover:text-tn-on-surface'"
	            @click="activeCodeTab = tab"
	          >
	            {{ tab }}
	          </button>
	        </div>

	        <div v-if="activeCodeTab !== 'MCP Config'" class="mt-6 grid grid-cols-1 gap-4">
	          <div
	            v-for="ex in codeExamples"
	            :key="ex.title"
	            class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10"
	          >
	            <div class="flex items-start justify-between gap-3">
	              <div>
	                <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Endpoint</div>
	                <div class="mt-1 text-sm font-semibold text-tn-on-surface">{{ ex.title }}</div>
	                <p v-if="ex.note" class="mt-1 text-xs text-tn-on-surface-variant">{{ ex.note }}</p>
	              </div>
	              <button
	                type="button"
	                class="shrink-0 rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	                @click="copyToClipboard(ex.snippets[activeCodeLang])"
	              >
	                Copy
	              </button>
	            </div>
	            <pre class="mt-3 overflow-x-auto rounded-2xl bg-tn-surface-lowest/60 p-4 font-mono text-sm text-tn-on-surface ring-1 ring-white/10"><code>{{ ex.snippets[activeCodeLang] }}</code></pre>
	          </div>
	        </div>

	        <div v-else class="mt-6">
	          <div class="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
	            <div class="flex items-start justify-between gap-3">
	              <div>
	                <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface-variant">Claude Code</div>
	                <div class="mt-1 text-sm font-semibold text-tn-on-surface">MCP server config</div>
	              </div>
	              <button
	                type="button"
	                class="shrink-0 rounded-xl bg-tn-surface-lowest/60 px-4 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	                @click="copyToClipboard(mcpConfigClaudeCode)"
	              >
	                Copy
	              </button>
	            </div>
	            <pre class="mt-3 overflow-x-auto rounded-2xl bg-tn-surface-lowest/60 p-4 font-mono text-sm text-tn-on-surface ring-1 ring-white/10"><code>{{ mcpConfigClaudeCode }}</code></pre>
	            <p class="mt-3 text-xs text-tn-on-surface-variant">Set <span class="font-mono">THREATNOIR_API_KEY</span> to your generated key.</p>
	          </div>
	        </div>
	      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
	import { useToast } from '~/composables/useToast'

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Developer API & MCP Server | ThreatNoir',
  description: 'IOC search API, MCP server for Claude and Cursor, webhooks, and RSS feeds. Build security automation with a free API key.',
  ogTitle: 'Developer API & MCP Server | ThreatNoir',
  ogDescription: 'IOC search API, MCP server for Claude and Cursor, webhooks, and RSS feeds. Build security automation with a free API key.',
  ogImage: 'https://threatnoir.com/images/category-default.png',
  ogUrl: 'https://threatnoir.com/developer',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Developer API & MCP Server | ThreatNoir',
  twitterDescription: 'IOC search API, MCP server for Claude and Cursor, webhooks, and RSS feeds. Build security automation with a free API key.',
  twitterImage: 'https://threatnoir.com/images/category-default.png',
  author: 'ThreatNoir'
})

const installSnippet = `# Using npx (recommended)
npx threatnoir-mcp-iocs

# Or add to your .mcp.json`

const mcpConfig = `{
  "mcpServers": {
    "threatnoir-iocs": {
      "command": "npx",
      "args": ["threatnoir-mcp-iocs"],
      "env": { "THREATNOIR_API_KEY": "your-key-here" }
    }
  }
}`

const restExamples = `GET https://threatnoir.com/api/v1/iocs?type=cve&limit=10
GET https://threatnoir.com/api/v1/iocs?q=192.168&type=ip

Authorization: Bearer tn_live_your_key`

const codeExampleTabs = ['Python', 'JavaScript', 'curl', 'MCP Config'] as const
type CodeExampleTab = typeof codeExampleTabs[number]
type CodeExampleLang = Exclude<CodeExampleTab, 'MCP Config'>

const activeCodeTab = ref<CodeExampleTab>('Python')
const activeCodeLang = computed<CodeExampleLang>(() => (activeCodeTab.value === 'MCP Config' ? 'Python' : activeCodeTab.value))

const mcpConfigClaudeCode = `{
  "mcpServers": {
    "threatnoir": {
      "command": "npx",
      "args": ["-y", "threatnoir-mcp-iocs"],
      "env": {
        "THREATNOIR_API_KEY": "tn_live_your_key_here"
      }
    }
  }
}`

const snip = (lines: string[]) => lines.join('\n')

const codeExamples: Array<{
  title: string
  note?: string
  snippets: Record<CodeExampleLang, string>
}> = [
  {
    title: 'IOC Search (free tier, no auth)',
    snippets: {
      Python: snip([
        'import requests',
        'r = requests.get("https://threatnoir.com/api/v1/iocs", params={"q": "log4j", "type": "cve"})',
        'for ioc in r.json()["items"]:',
        '    print(f\'{ioc["type"]}: {ioc["value"]} — {ioc["article"]["title"]}\')'
      ]),
      JavaScript: snip([
        'const res = await fetch("https://threatnoir.com/api/v1/iocs?q=log4j&type=cve")',
        'const { items } = await res.json()',
        'items.forEach(ioc => console.log(`${ioc.type}: ${ioc.value}`))'
      ]),
      curl: 'curl -s "https://threatnoir.com/api/v1/iocs?q=log4j&type=cve" | jq \'.items[] | "\\(.type): \\(.value)"\''
    }
  },
  {
    title: 'IOC Search (with API key, higher limits)',
    note: 'Add an Authorization header to use your API key.',
    snippets: {
      Python: snip([
        'headers = {"Authorization": "Bearer tn_live_your_key_here"}',
        'r = requests.get("https://threatnoir.com/api/v1/iocs", params={"q": "192.168"}, headers=headers)'
      ]),
      JavaScript: snip([
        'const res = await fetch("https://threatnoir.com/api/v1/iocs?q=192.168", {',
        '  headers: { Authorization: "Bearer tn_live_your_key_here" }',
        '})',
        'const data = await res.json()',
        'console.log(data)'
      ]),
      curl: 'curl -s -H "Authorization: Bearer tn_live_..." "https://threatnoir.com/api/v1/iocs?q=192.168" | jq'
    }
  },
  {
    title: 'Articles',
    snippets: {
      Python: 'r = requests.get("https://threatnoir.com/api/v1/articles", params={"q": "ransomware", "limit": 5})',
      JavaScript: snip([
        'const res = await fetch("https://threatnoir.com/api/v1/articles?q=ransomware&limit=5")',
        'const data = await res.json()',
        'console.log(data)'
      ]),
      curl: 'curl -s "https://threatnoir.com/api/v1/articles?q=ransomware&limit=5" | jq'
    }
  },
  {
    title: 'Weekly Roundups',
    snippets: {
      Python: 'r = requests.get("https://threatnoir.com/api/v1/weekly", params={"limit": 3})',
      JavaScript: snip([
        'const res = await fetch("https://threatnoir.com/api/v1/weekly?limit=3")',
        'const data = await res.json()',
        'console.log(data)'
      ]),
      curl: 'curl -s "https://threatnoir.com/api/v1/weekly?limit=3" | jq'
    }
  },
  {
    title: 'Focus Items',
    snippets: {
      Python: 'r = requests.get("https://threatnoir.com/api/v1/focus", params={"severity": "critical"})',
      JavaScript: snip([
        'const res = await fetch("https://threatnoir.com/api/v1/focus?severity=critical")',
        'const data = await res.json()',
        'console.log(data)'
      ]),
      curl: 'curl -s "https://threatnoir.com/api/v1/focus?severity=critical" | jq'
    }
  },
  {
    title: 'Awareness Lessons',
    snippets: {
      Python: 'r = requests.get("https://threatnoir.com/api/v1/awareness", params={"q": "phishing"})',
      JavaScript: snip([
        'const res = await fetch("https://threatnoir.com/api/v1/awareness?q=phishing")',
        'const data = await res.json()',
        'console.log(data)'
      ]),
      curl: 'curl -s "https://threatnoir.com/api/v1/awareness?q=phishing" | jq'
    }
  },
  {
    title: 'Submit Article (auth required)',
    note: 'Requires a valid API key in the Authorization header.',
    snippets: {
      Python: snip([
        'headers = {"Authorization": "Bearer tn_live_your_key_here"}',
        'r = requests.post("https://threatnoir.com/api/v1/submit",',
        '    headers=headers,',
        '    json={"url": "https://example.com/security-article", "source_name": "My Feed"})'
      ]),
      JavaScript: snip([
        'const res = await fetch("https://threatnoir.com/api/v1/submit", {',
        '  method: "POST",',
        '  headers: {',
        '    Authorization: "Bearer tn_live_your_key_here",',
        '    "Content-Type": "application/json"',
        '  },',
        '  body: JSON.stringify({',
        '    url: "https://example.com/security-article",',
        '    source_name: "My Feed"',
        '  })',
        '})',
        'const data = await res.json()',
        'console.log(data)'
      ]),
      curl: snip([
        'curl -s -X POST "https://threatnoir.com/api/v1/submit" \\',
        '  -H "Authorization: Bearer tn_live_..." \\',
        '  -H "Content-Type: application/json" \\',
        '  -d \'{"url":"https://example.com/security-article","source_name":"My Feed"}\' | jq'
      ])
    }
  }
]

const rateLimitRows = [
  { tier: 'Free (no key)', search: '10/hour, 10 results', list: '30/min, 50 results', limit: '—' },
  { tier: 'API Key', search: '100/min, 50 results', list: '100/min, 50 results', limit: '5 keys max' }
]

const tools = [
  {
    name: 'search_iocs',
    desc: 'Search IOCs by keyword.',
    params: ['query: string', 'type?: string', 'limit?: number']
  },
  {
    name: 'list_iocs',
    desc: 'List recent IOCs.',
    params: ['type?: string', 'limit?: number']
  },
  {
    name: 'lookup_ioc',
    desc: 'Exact match lookup.',
    params: ['value: string']
  }
]

const iocTypes = [
  { type: 'ip', example: '8.8.8.8' },
  { type: 'domain', example: 'example.com' },
  { type: 'hash_md5', example: 'd41d8cd98f00b204e9800998ecf8427e' },
  { type: 'hash_sha1', example: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' },
  { type: 'hash_sha256', example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { type: 'url', example: 'https://example.com/path' },
  { type: 'cve', example: 'CVE-2024-12345' },
  { type: 'mitre_attack', example: 'T1059' },
  { type: 'email', example: 'analyst@example.com' },
  { type: 'malware', example: 'Emotet' }
]

async function copyToClipboard(value: string) {
  if (!import.meta.client) return
  const v = (value || '').trim()
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
	    useToast().show('Copied')
  } catch {
	    useToast().show('Copy failed', 'error')
    window.prompt('Copy value:', v)
  }
}
</script>
