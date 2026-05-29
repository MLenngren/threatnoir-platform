// https://nuxt.com/docs/api/configuration/nuxt-config

import { DEFAULT_SITE_NAME, DEFAULT_SITE_TAGLINE, DEFAULT_SITE_URL } from './shared/siteDefaults'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SEO is important for a curated news site
  ssr: true,

  // Keep application source under /app (same pattern as bestcoworkers.com)
  srcDir: 'app/',

  css: ['~/assets/css/main.css'],

	runtimeConfig: {
	  public: {
	    sponsorLabel: process.env.NUXT_PUBLIC_SPONSOR_LABEL || '',

		    contactEmail: process.env.NUXT_PUBLIC_CONTACT_EMAIL || 'contact@example.com',

	    siteName: process.env.NUXT_PUBLIC_SITE_NAME || DEFAULT_SITE_NAME,
	    siteTagline: process.env.NUXT_PUBLIC_SITE_TAGLINE || DEFAULT_SITE_TAGLINE,
	    siteUrl: process.env.NUXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
	    siteLogoUrl: process.env.NUXT_PUBLIC_SITE_LOGO_URL || '',
	    siteOgImageUrl: process.env.NUXT_PUBLIC_SITE_OG_IMAGE_URL || '',
	    podcastArtworkUrl: process.env.NUXT_PUBLIC_PODCAST_ARTWORK_URL || '',
	    socialXUrl: process.env.NUXT_PUBLIC_SOCIAL_X_URL || '',
	    socialLinkedinUrl: process.env.NUXT_PUBLIC_SOCIAL_LINKEDIN_URL || '',
	    socialGithubUrl: process.env.NUXT_PUBLIC_SOCIAL_GITHUB_URL || '',
	    operatorLegalName: process.env.NUXT_PUBLIC_OPERATOR_LEGAL_NAME || ''
	  }
	},

  routeRules: {
    // Homepage — tolerates up to 60s staleness for latest articles, focus items, etc.
    '/': { swr: 60 },

    // List pages — content updates daily but minute-level staleness is fine
    '/feed': { swr: 30 },
	    '/brief': { swr: 60 },
    '/podcast': { swr: 60 },
    '/podcast/archive': { swr: 600 },
    '/show': { swr: 60 },
    '/weekly': { swr: 60 },
    '/awareness': { swr: 600 },
    '/focus': { swr: 300 },
    '/events': { swr: 600 },
    '/iocs': { swr: 600 },
    '/tips': { swr: 600 },

    // Detail pages — almost never change after publish
    '/article/**': { swr: 300 },
    '/show/**': { swr: 300 },
    '/weekly/**': { swr: 600 },
    '/awareness/**': { swr: 600 },
    '/focus/**': { swr: 300 },
    '/events/**': { swr: 600 },
    '/tag/**': { swr: 300 },

    // Static landing pages — long cache, content rarely changes
    '/for-soc': { swr: 3600 },
    '/for-leaders': { swr: 3600 },
    '/for-learners': { swr: 3600 },
    '/for-developers': { swr: 3600 },
    '/developer': { swr: 3600 },
    '/resources': { swr: 3600 },
    '/opensource': { swr: 3600 },
    '/legal': { swr: 86400 },
    '/contact': { swr: 3600 },
    '/review': { swr: 3600 },

    // Admin and auth — never cache
    '/admin/**': { ssr: true, headers: { 'cache-control': 'private, no-store' } },
    '/auth/**': { ssr: true, headers: { 'cache-control': 'private, no-store' } },
    '/settings/**': { ssr: true, headers: { 'cache-control': 'private, no-store' } },
    '/subscribe/**': { ssr: true, headers: { 'cache-control': 'private, no-store' } }
  },

  modules: ['@nuxtjs/supabase', '@nuxt/ui', '@nuxt/fonts', '@vueuse/nuxt', '@nuxt/eslint', '@vercel/analytics/nuxt'],

  fonts: {
    families: [
      {
        name: 'Inter',
        provider: 'google',
        weights: [400, 500, 600, 700, 800, 900],
        global: true
      },
      {
        name: 'Space Grotesk',
        provider: 'google',
        weights: [300, 400, 500, 600, 700],
        global: true
      }
    ]
  },

  app: {
    head: {
	    // Brand/title/meta defaults are configured at runtime via app/app.vue using useSiteConfig().
	    meta: [],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512.png' },
        { rel: 'apple-touch-icon', sizes: '512x512', href: '/icon-512.png' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
	        }
      ]
    }
  },

  // Prefer dark mode by default
  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  supabase: {
    // Disable automatic redirect on unauthenticated pages (public site)
    redirect: false,
    redirectOptions: {
      login: '/admin/login',
      callback: '/confirm'
    }
  }
})
