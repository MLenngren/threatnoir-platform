<template>
	<main class="grid-bg py-10">
	  <div class="mx-auto max-w-4xl px-6">
	    <section class="glass-panel rounded-3xl p-6 md:p-10">
	      <div class="flex items-center gap-3">
	        <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	        <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Subscription</span>
	      </div>
	      <h1 class="mt-3 font-headline text-3xl font-black uppercase tracking-tight text-tn-on-surface md:text-4xl">You’re subscribed!</h1>
	      <p class="mt-3 max-w-2xl text-sm leading-6 text-tn-on-surface-variant md:text-base">
	        You’ll receive notifications based on your preferences.
	      </p>

	      <div class="mt-7 flex flex-col gap-3 sm:flex-row">
	        <NuxtLink
	          to="/settings"
	          class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
	        >
	          <UIcon name="i-heroicons-adjustments-horizontal" class="h-4 w-4" />
	          Open Settings
	        </NuxtLink>
	        <NuxtLink
	          to="/feed"
	          class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	        >
	          Browse Articles
	        </NuxtLink>
	      </div>
	    </section>
	  </div>
	</main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({
  title: "You're subscribed! — ThreatNoir",
  description: 'Subscription confirmed.'
})
</script>
