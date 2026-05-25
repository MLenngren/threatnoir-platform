<template>
  <section class="py-16 md:py-20">
    <div class="mx-auto max-w-6xl px-6">
      <div class="mb-10 text-center md:mb-14">
        <p class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Free account</p>
        <h2 class="mt-3 text-balance font-headline text-3xl font-black tracking-tight text-tn-on-surface md:text-4xl">
          What you get with a free account
        </h2>
        <p class="mx-auto mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
          Sign in to tailor delivery channels, manage alert topics, and generate API keys for developer access.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div class="rounded-2xl bg-tn-surface-low/50 p-6 ring-1 ring-white/10">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-bell-alert" class="mt-0.5 h-5 w-5 text-tn-primary" />
            <div>
              <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface">Notification channels</div>
              <div class="mt-2 text-sm leading-6 text-tn-on-surface-variant">
                Customize delivery via Email, Discord, Telegram, or Webhook.
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl bg-tn-surface-low/50 p-6 ring-1 ring-white/10">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-funnel" class="mt-0.5 h-5 w-5 text-tn-primary" />
            <div>
              <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface">Topics & preferences</div>
              <div class="mt-2 text-sm leading-6 text-tn-on-surface-variant">
                Manage subscription preferences and the security topics you care about.
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl bg-tn-surface-low/50 p-6 ring-1 ring-white/10">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-key" class="mt-0.5 h-5 w-5 text-tn-primary" />
            <div>
              <div class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-on-surface">API keys</div>
              <div class="mt-2 text-sm leading-6 text-tn-on-surface-variant">
                Generate keys for MCP server + REST API access.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-10 flex flex-col items-center gap-4">
        <NuxtLink
          to="/auth/signup"
          class="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-6 py-4 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-cyan-950/30 hover:brightness-110"
        >
          Create free account
        </NuxtLink>
        <p class="text-center text-xs leading-5 text-tn-on-surface-variant">
          Most content is free without signing up.
        </p>
      </div>
    </div>
  </section>
</template>
