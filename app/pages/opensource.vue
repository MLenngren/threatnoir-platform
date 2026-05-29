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
            <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Open Source</div>
            <span class="h-1 w-1 rounded-full bg-white/15" />
            <span class="inline-flex items-center rounded-full bg-tn-surface-lowest/60 px-2 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface-variant ring-1 ring-white/10">
              Apache 2.0
            </span>
          </div>
	          <h1 class="mt-4 text-balance font-headline text-3xl font-black uppercase tracking-tight text-tn-on-surface md:text-5xl">
	            {{ site.name }} is open source
          </h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
            The entire platform — ingest pipeline, AI summarization, IOC extraction, admin UI, public API — is available under Apache 2.0. Deploy your own instance, customize it, contribute back, or just read the code.
          </p>

          <div class="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://github.com/MLenngren/threatnoir-platform"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
            >
              View on GitHub →
            </a>
            <a
              href="https://github.com/MLenngren/threatnoir-platform#quick-start-local-15-minutes"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
            >
              Quick start →
            </a>
          </div>
        </div>
      </section>

      <!-- Why -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Why open source?</h2>
	          <p class="mt-4 text-sm leading-7 text-tn-on-surface-variant md:text-base">
	          {{ site.name }} was built to solve a real problem: making curated security intelligence accessible without locked-in vendors. Open-sourcing the platform means SOC teams, ISACs, security educators, and individual researchers can deploy their own instance — tuned to their sources, audience, and budget — without rebuilding the pipeline from scratch.
        </p>
        <p class="mt-3 text-sm leading-7 text-tn-on-surface-variant md:text-base">
          We also wanted the code to be inspectable. If you're going to trust an AI pipeline to summarize and classify your security news, you should be able to read exactly how it works.
        </p>
      </section>

      <!-- What you get -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">What's included</h2>
        <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-primary">Ingest & enrichment</div>
            <ul class="mt-3 space-y-2 text-sm text-tn-on-surface-variant">
              <li>RSS pulls from 6+ default sources, add your own via admin UI</li>
              <li>AI summary, classification, IOC extraction, relevance scoring (one Claude call per article)</li>
              <li>Auto-approve / auto-reject thresholds + moderation queue</li>
            </ul>
          </div>

          <div class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-primary">Distribution</div>
            <ul class="mt-3 space-y-2 text-sm text-tn-on-surface-variant">
              <li>Public site (feed, daily brief, weekly roundup, focus, awareness)</li>
              <li>Weekly digest email with per-channel subscriber preferences</li>
              <li>Daily podcast (audio TTS) and optional video briefings</li>
            </ul>
          </div>

          <div class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-primary">Public API</div>
            <ul class="mt-3 space-y-2 text-sm text-tn-on-surface-variant">
              <li>IOC search (CVE, IP, domain, hash, MITRE TTP)</li>
              <li>Articles, focus items, weekly roundups, awareness lessons</li>
              <li>Optional API key auth + per-key rate limits</li>
            </ul>
          </div>

          <div class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-tn-primary">Admin & ops</div>
            <ul class="mt-3 space-y-2 text-sm text-tn-on-surface-variant">
              <li>Moderation, source/category management, RBAC, audit log</li>
              <li>Per-pipeline AI cost dashboard (track Anthropic spend by feature)</li>
              <li>Auto-generated LinkedIn/X/Mastodon drafts for review</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Deploy your own -->
      <section class="mt-8 glass-panel rounded-3xl p-6 md:p-8">
        <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Deploy your own — three steps</h2>
        <ol class="mt-5 space-y-4">
          <li class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="flex items-start gap-4">
              <span class="shrink-0 rounded-full bg-tn-primary/20 px-3 py-1 font-mono text-sm text-tn-primary">1</span>
              <div>
                <div class="text-sm font-semibold text-tn-on-surface">Clone + run locally</div>
                <p class="mt-1 text-sm text-tn-on-surface-variant">
                  Requires Node 20+, npm, Docker (for local Supabase). 15 minutes to first run.
                </p>
                <pre class="mt-3 overflow-x-auto rounded-xl bg-tn-surface-lowest/60 p-3 font-mono text-xs text-tn-on-surface ring-1 ring-white/10"><code>git clone https://github.com/MLenngren/threatnoir-platform
cd threatnoir-platform
npm install
npx supabase start
cp .env.local.example .env.local
npm run dev</code></pre>
              </div>
            </div>
          </li>

          <li class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="flex items-start gap-4">
              <span class="shrink-0 rounded-full bg-tn-primary/20 px-3 py-1 font-mono text-sm text-tn-primary">2</span>
              <div>
                <div class="text-sm font-semibold text-tn-on-surface">Create production accounts</div>
                <p class="mt-1 text-sm text-tn-on-surface-variant">
                  Supabase project, Vercel project, Resend account, Anthropic API key. All have free tiers that fit early-stage deployments. Cost at small scale: <span class="text-tn-on-surface">~$50–150/month</span> all-in.
                </p>
              </div>
            </div>
          </li>

          <li class="rounded-2xl bg-black/20 p-5 ring-1 ring-white/10">
            <div class="flex items-start gap-4">
              <span class="shrink-0 rounded-full bg-tn-primary/20 px-3 py-1 font-mono text-sm text-tn-primary">3</span>
              <div>
                <div class="text-sm font-semibold text-tn-on-surface">Wire env vars + deploy</div>
                <p class="mt-1 text-sm text-tn-on-surface-variant">
                  Configure ~7 required env vars in Vercel, push to main, auto-deploy. Optional integrations (podcast, video, social posting) layer on per-feature. See the
                  <a href="https://github.com/MLenngren/threatnoir-platform#production-deployment-2-hours" target="_blank" rel="noopener" class="text-tn-primary hover:underline">full deployment guide</a>.
                </p>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <!-- License + contribute -->
      <section class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="glass-panel rounded-3xl p-6 md:p-8">
          <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">License</h2>
          <p class="mt-3 text-sm leading-7 text-tn-on-surface-variant">
            Apache License 2.0. You're free to use, modify, redistribute, and commercialize the code. You must preserve the license + notice files. Modifications must be marked.
          </p>
          <a
            href="https://github.com/MLenngren/threatnoir-platform/blob/main/LICENSE"
            target="_blank"
            rel="noopener"
            class="mt-4 inline-flex items-center text-sm text-tn-primary hover:underline"
          >
            Read the full license →
          </a>
        </div>

        <div class="glass-panel rounded-3xl p-6 md:p-8">
          <h2 class="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface">Contribute</h2>
          <p class="mt-3 text-sm leading-7 text-tn-on-surface-variant">
            Bug fixes, new RSS sources, accessibility improvements, performance tuning, documentation — all welcome. Read
            <a href="https://github.com/MLenngren/threatnoir-platform/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" class="text-tn-primary hover:underline">CONTRIBUTING.md</a>
            first.
          </p>
          <p class="mt-3 text-sm leading-7 text-tn-on-surface-variant">
            If you deploy your own instance, open an issue tagged <span class="font-mono text-xs">showcase</span> — we'd love to hear about it.
          </p>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
	const site = useSiteConfig()
useSeoMeta({
	  title: `Open Source — ${site.name}`,
	  description: `${site.name} is open source under Apache 2.0. Deploy your own curated security news platform with AI summarization, IOC extraction, and a public API.`,
	  ogTitle: `${site.name} is open source — Apache 2.0`,
	  ogDescription: `The entire ${site.name} platform — ingest, AI summarization, IOC extraction, admin UI, API — available under Apache 2.0. Deploy your own.`,
  ogType: 'website',
	  ogUrl: `${site.url}/opensource`,
  twitterCard: 'summary_large_image'
})

useHead({
	  link: [{ rel: 'canonical', href: `${site.url}/opensource` }]
})
</script>
