<template>
	<main class="grid-bg py-20">
	  <div class="mx-auto max-w-6xl px-6">
	    <section class="glass-panel mx-auto max-w-xl rounded-3xl p-7 text-center md:p-10">
	      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-tn-surface-lowest/60 ring-1 ring-white/10">
	        <UIcon name="i-heroicons-shield-check" class="h-6 w-6 text-tn-primary" />
	      </div>

	      <div class="mt-5 flex items-center justify-center gap-3">
	        <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
	        <span class="font-label text-[10px] font-bold uppercase tracking-widest text-tn-primary">Authentication required</span>
	      </div>

	      <h1 class="mt-3 font-headline text-3xl font-black uppercase tracking-tight text-tn-on-surface">Sign in required</h1>
	      <p class="mt-3 text-sm leading-6 text-tn-on-surface-variant">
	        Create an account to customize your security news feed and receive notifications.
	      </p>

	      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
	        <NuxtLink
	          :to="loginHref"
	          class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-tn-primary to-tn-primary-container px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:brightness-110"
	        >
	          <UIcon name="i-heroicons-arrow-right" class="h-4 w-4" />
	          Log in
	        </NuxtLink>
	        <NuxtLink
	          :to="signupHref"
	          class="inline-flex items-center justify-center rounded-xl bg-tn-surface-lowest/60 px-5 py-3 font-label text-[11px] font-bold uppercase tracking-[0.2em] text-tn-on-surface ring-1 ring-white/10 hover:bg-tn-surface-lowest"
	        >
	          Create account
	        </NuxtLink>
	      </div>
	    </section>
	  </div>
	</main>
</template>

<script setup lang="ts">
const route = useRoute()

const encodedRedirect = computed(() => encodeURIComponent(route.fullPath))

const loginHref = computed(() => `/auth/login?redirect=${encodedRedirect.value}`)
const signupHref = computed(() => `/auth/signup?redirect=${encodedRedirect.value}`)
</script>

