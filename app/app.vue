<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const site = useSiteConfig()

useHead(() => ({
  titleTemplate: (titleChunk) => {
    const chunk = (titleChunk || '').trim()
    return chunk ? `${chunk} | ${site.name}` : site.name
  },
  meta: [
    { name: 'description', content: site.tagline },
    { property: 'og:site_name', content: site.name }
  ],
  link: [
    { rel: 'alternate', type: 'application/rss+xml', title: `${site.name} — All Content`, href: '/api/feed.xml' },
    { rel: 'alternate', type: 'application/rss+xml', title: `${site.name} — Articles`, href: '/api/articles/feed.xml' },
    { rel: 'alternate', type: 'application/rss+xml', title: `${site.name} — Awareness Lessons`, href: '/api/awareness/feed.xml' },
    { rel: 'alternate', type: 'application/rss+xml', title: `${site.name} — Active Focus Items`, href: '/api/focus/feed.xml' },
    { rel: 'alternate', type: 'application/rss+xml', title: `${site.name} — Podcast`, href: '/api/podcast/feed.xml' },
    { rel: 'alternate', type: 'application/rss+xml', title: `${site.name} — Weekly Roundup`, href: '/api/weekly/feed.xml' }
  ]
}))
</script>
