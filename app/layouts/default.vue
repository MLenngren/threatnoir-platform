<template>
  <div class="min-h-dvh bg-tn-surface text-tn-on-surface font-body selection:bg-tn-primary/30">
    <header class="fixed top-0 z-50 w-full bg-slate-950/70 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img src="/icon.svg" alt="" class="h-6 w-6">
          <span class="font-headline text-sm font-black tracking-tight text-tn-primary uppercase">
            THREATNOIR
          </span>
        </NuxtLink>

        <nav class="hidden items-center gap-6 md:flex">
	          <!-- Start here dropdown -->
	          <div class="group relative" @mouseenter="openDropdown = 'start'" @mouseleave="openDropdown = null">
	            <button
	              type="button"
	              class="flex items-center gap-1 py-1 font-label text-xs uppercase tracking-widest transition-colors"
	              :class="isStartHereActive ? 'text-tn-primary' : 'text-slate-400 hover:text-slate-200'"
	            >
	              Start here
	              <UIcon name="i-heroicons-chevron-down" class="h-3 w-3" />
	            </button>
	            <div
	              v-show="openDropdown === 'start'"
	              class="absolute left-1/2 top-full w-[34rem] -translate-x-1/2 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl before:absolute before:-top-3 before:left-0 before:h-3 before:w-full"
	            >
	              <div class="grid grid-cols-2 gap-3 p-3">
	                <NuxtLink
	                  v-for="p in startHerePersonas"
	                  :key="p.key"
	                  :to="p.href"
	                  class="group rounded-2xl bg-tn-surface-low/70 p-4 ring-1 ring-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:ring-tn-primary/40 hover:shadow-[0_8px_30px_rgba(76,215,246,0.12)]"
	                  @click="openDropdown = null"
	                >
	                  <div class="flex items-center gap-3">
	                    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-tn-primary/10 ring-1 ring-tn-primary/20">
	                      <UIcon :name="p.icon" class="h-5 w-5 text-tn-primary" />
	                    </div>
	                    <div class="min-w-0">
	                      <div
	                        class="truncate font-headline text-sm font-bold tracking-tight"
	                        :class="route.path === p.href ? 'text-tn-primary' : 'text-tn-on-surface'"
	                      >
	                        {{ p.title }}
	                      </div>
	                      <div class="mt-1 line-clamp-2 text-xs leading-relaxed text-tn-on-surface-variant">
	                        {{ p.hook }}
	                      </div>
	                    </div>
	                  </div>
	                </NuxtLink>
	              </div>
	            </div>
	          </div>

          <div class="relative">
            <NuxtLink
              to="/feed"
              class="flex items-center py-1 font-label text-xs uppercase tracking-widest transition-colors"
              :class="route.path.startsWith('/feed') ? 'text-tn-primary' : 'text-slate-400 hover:text-slate-200'"
            >
              Feed
            </NuxtLink>
          </div>

          <!-- Intel dropdown -->
          <div class="group relative" @mouseenter="openDropdown = 'intel'" @mouseleave="openDropdown = null">
            <button
              type="button"
              class="flex items-center gap-1 py-1 font-label text-xs uppercase tracking-widest transition-colors"
              :class="isIntelActive ? 'text-tn-primary' : 'text-slate-400 hover:text-slate-200'"
            >
              Intel
              <UIcon name="i-heroicons-chevron-down" class="h-3 w-3" />
            </button>
            <div
              v-show="openDropdown === 'intel'"
              class="absolute -left-2 top-full w-52 rounded-lg border border-slate-800 bg-slate-900 shadow-2xl before:absolute before:-top-3 before:left-0 before:h-3 before:w-full"
            >
              <NuxtLink to="/briefs" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
                Briefs
              </NuxtLink>
              <NuxtLink to="/iocs" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
                IOCs
              </NuxtLink>
              <NuxtLink to="/legal" class="block px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
                Legal
              </NuxtLink>
            </div>
          </div>

          <!-- Media dropdown -->
          <div class="group relative" @mouseenter="openDropdown = 'media'" @mouseleave="openDropdown = null">
            <button
              type="button"
              class="flex items-center gap-1 py-1 font-label text-xs uppercase tracking-widest transition-colors"
              :class="isMediaActive ? 'text-tn-primary' : 'text-slate-400 hover:text-slate-200'"
            >
              Media
              <UIcon name="i-heroicons-chevron-down" class="h-3 w-3" />
            </button>
            <div
              v-show="openDropdown === 'media'"
              class="absolute -left-2 top-full w-52 rounded-lg border border-slate-800 bg-slate-900 shadow-2xl before:absolute before:-top-3 before:left-0 before:h-3 before:w-full"
            >
			  <NuxtLink to="/podcast" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
                Podcast
              </NuxtLink>
			  <NuxtLink to="/weekly" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
			    Weekly Roundup
			  </NuxtLink>
              <NuxtLink to="/review" class="block px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
                Reviews
              </NuxtLink>
            </div>
          </div>

          <!-- Learn dropdown -->
          <div class="group relative" @mouseenter="openDropdown = 'learn'" @mouseleave="openDropdown = null">
            <button
              type="button"
              class="flex items-center gap-1 py-1 font-label text-xs uppercase tracking-widest transition-colors"
              :class="isLearnActive ? 'text-tn-primary' : 'text-slate-400 hover:text-slate-200'"
            >
              Learn
              <UIcon name="i-heroicons-chevron-down" class="h-3 w-3" />
            </button>
            <div
              v-show="openDropdown === 'learn'"
              class="absolute -left-2 top-full w-52 rounded-lg border border-slate-800 bg-slate-900 shadow-2xl before:absolute before:-top-3 before:left-0 before:h-3 before:w-full"
            >
              <NuxtLink to="/tips" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
                Tips & Tricks
              </NuxtLink>
	              <NuxtLink to="/awareness" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
                Awareness
              </NuxtLink>
		              <NuxtLink to="/show" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
		                Red vs Blue Show
		              </NuxtLink>
	              <NuxtLink to="/events" class="block border-b border-slate-800/50 px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
	                Events
	              </NuxtLink>
	              <NuxtLink to="/resources" class="block px-4 py-3 font-label text-[10px] uppercase tracking-widest text-slate-400 transition-all hover:bg-white/5 hover:text-tn-primary" @click="openDropdown = null">
	                Resources
	              </NuxtLink>
            </div>
          </div>

          <div class="relative">
            <NuxtLink
              to="/developer"
              class="flex items-center py-1 font-label text-xs uppercase tracking-widest transition-colors"
              :class="route.path.startsWith('/developer') ? 'text-tn-primary' : 'text-slate-400 hover:text-slate-200'"
            >
              Developer
            </NuxtLink>
          </div>
        </nav>

        <div class="flex items-center gap-2">
          <NuxtLink
            to="/subscribe"
            class="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-tn-primary to-tn-primary-container px-3 py-2 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-black shadow-lg shadow-cyan-950/30 hover:brightness-110"
          >
            Subscribe
          </NuxtLink>

          <div class="hidden items-center gap-3 md:flex">
            <template v-if="user?.email">
              <NuxtLink to="/settings" :class="navClass('/settings')">Settings</NuxtLink>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :loading="signingOut"
                @click="onLogout"
              >
                Log out
              </UButton>
            </template>
            <template v-else>
              <NuxtLink :to="loginHref" class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant hover:text-tn-primary">
                Log in
              </NuxtLink>
            </template>
          </div>

          <ClientOnly>
            <UDropdownMenu class="md:hidden" :items="mobileMenuItems">
              <UButton
                icon="i-heroicons-bars-3"
                variant="ghost"
                color="neutral"
                size="sm"
                aria-label="Open menu"
              />
            </UDropdownMenu>
          </ClientOnly>
        </div>
      </div>
    </header>

    <main class="pt-20">
      <slot />
    </main>

	    <Toast />

    <footer class="border-t border-white/5 bg-slate-950 px-6 py-12">
      <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 md:flex-row">
        <div class="flex flex-col items-center gap-2 md:items-start">
          <div class="font-headline text-sm font-bold tracking-tight text-tn-primary uppercase">THREATNOIR</div>
          <p class="font-label text-[10px] uppercase tracking-widest text-tn-on-surface-variant">
            © {{ new Date().getFullYear() }} ThreatNoir. All rights reserved.
          </p>
        </div>

        <div class="flex flex-wrap justify-center gap-6">
          <NuxtLink to="/feed" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Feed</NuxtLink>
          <NuxtLink to="/briefs" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Briefs</NuxtLink>
          <NuxtLink to="/iocs" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">IOCs</NuxtLink>
	          <NuxtLink to="/podcast" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Podcast</NuxtLink>
	          <NuxtLink to="/weekly" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Weekly Roundup</NuxtLink>
          <NuxtLink to="/tips" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Tips</NuxtLink>
	          <NuxtLink to="/awareness" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Awareness Lessons</NuxtLink>
          <NuxtLink to="/resources" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Resources</NuxtLink>
          <NuxtLink to="/developer" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Developer</NuxtLink>
          <NuxtLink to="/opensource" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Open Source</NuxtLink>
          <NuxtLink to="/legal" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Legal</NuxtLink>
          <NuxtLink to="/contact" class="font-label text-[10px] uppercase tracking-widest text-slate-600 hover:text-tn-primary">Contact</NuxtLink>
        </div>

        <div class="flex items-center gap-4">
          <a href="https://open.spotify.com/show/7BOABAMyjIF0YEvNiJpvbd" target="_blank" rel="noopener noreferrer" class="text-slate-600 transition-colors hover:text-[#1DB954]" title="ThreatNoir on Spotify">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          </a>
          <a href="https://www.youtube.com/playlist?list=PLyjcdGU9nPQQK6ZocOuTdtkC626Jk6L2G" target="_blank" rel="noopener noreferrer" class="text-slate-600 transition-colors hover:text-[#FF0000]" title="ThreatNoir on YouTube">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a>
          <div class="flex items-center gap-3">
            <span class="h-2 w-2 animate-pulse rounded-full bg-tn-primary" />
            <span class="font-label text-[10px] uppercase tracking-widest text-tn-primary">
              System status: nominal
            </span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()

	useHead({
	  link: [
	    {
	      rel: 'stylesheet',
	      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
	    }
	  ]
	})

const signingOut = ref(false)
const openDropdown = ref<string | null>(null)

const loginHref = computed(() => {
  const redirect = route.fullPath
  return `/auth/login?redirect=${encodeURIComponent(redirect)}`
})

const _displayEmail = computed(() => {
  const e = (user.value?.email || '').trim()
  if (!e) return ''
  if (e.length <= 24) return e
  return `${e.slice(0, 21)}…`
})

async function onLogout() {
  signingOut.value = true
  try {
    await supabase.auth.signOut()
  } finally {
    signingOut.value = false
    window.location.href = '/'
  }
}

function navClass(to: string) {
  const base =
    'font-label text-xs uppercase tracking-widest transition-colors border-b-2 border-transparent pb-1 text-slate-400 hover:text-slate-200'
  const active = 'text-tn-primary border-b-2 border-tn-primary'

  const isActive = to === '/' ? route.path === '/' : route.path.startsWith(to)
  return isActive ? `${base} ${active}` : base
}

const isIntelActive = computed(() => ['/briefs', '/iocs', '/legal'].some((p) => route.path.startsWith(p)))
	const isMediaActive = computed(() => ['/podcast', '/weekly', '/review'].some((p) => route.path.startsWith(p)))
		const isLearnActive = computed(() => ['/tips', '/awareness', '/events', '/resources', '/show'].some((p) => route.path.startsWith(p)))
			const isStartHereActive = computed(() => route.path.startsWith('/for-'))

	const startHerePersonas = [
	  {
	    key: 'soc',
	    icon: 'i-heroicons-shield-check',
	    title: 'SOC & Threat Hunting',
	    hook: 'Daily briefings + IOCs you can operationalize fast.',
	    href: '/for-soc'
	  },
	  {
	    key: 'leaders',
	    icon: 'i-heroicons-briefcase',
	    title: 'CISOs & Leaders',
	    hook: 'Board-ready context and weekly risk signal.',
	    href: '/for-leaders'
	  },
	  {
	    key: 'learners',
	    icon: 'i-heroicons-academic-cap',
	    title: 'Learners',
	    hook: 'Learn from real incidents, not hypotheticals.',
	    href: '/for-learners'
	  },
	  {
	    key: 'developers',
	    icon: 'i-heroicons-code-bracket',
	    title: 'Builders',
	    hook: 'APIs, MCP, and automation-ready threat intel.',
	    href: '/for-developers'
	  }
	]

const mobileMenuItems = computed(() => {
	  const startHere = startHerePersonas.map((p) => ({
	    label: `Start here — ${p.title}`,
	    to: p.href,
	    icon: p.icon
	  }))

  const links = [
    { label: 'Home', to: '/' },
    { label: 'Feed', to: '/feed' },
    { label: 'Briefs', to: '/briefs' },
    { label: 'IOCs', to: '/iocs' },
	    { label: 'Podcast', to: '/podcast' },
	    { label: 'Weekly Roundup', to: '/weekly' },
	    { label: 'Reviews', to: '/review' },
    { label: 'Tips & Tricks', to: '/tips' },
	    { label: 'Awareness Lessons', to: '/awareness' },
	      { label: 'Red vs Blue Show', to: '/show' },
	    { label: 'Events', to: '/events' },
    { label: 'Resources', to: '/resources' },
    { label: 'Developer', to: '/developer' },
    { label: 'Legal', to: '/legal' },
    { label: 'Contact', to: '/contact' },
    { label: 'Subscribe', to: '/subscribe' }
  ]

  const auth = user.value?.email
    ? [
        { label: 'Settings', to: '/settings' },
        { label: signingOut.value ? 'Signing out…' : 'Log out', disabled: signingOut.value, onSelect: () => onLogout() }
      ]
    : [{ label: 'Log in', to: loginHref.value }]

  return [
	    startHere,
	    links.map((l) => ({ label: l.label, to: l.to })),
    auth
  ]
})
</script>
