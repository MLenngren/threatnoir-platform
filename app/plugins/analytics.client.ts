type TrackEvent = (type: string, metadata?: Record<string, unknown>) => Promise<void>

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const router = useRouter()

  const trackEvent: TrackEvent = async (type, metadata) => {
    // Respect Do Not Track
    const dnt = navigator.doNotTrack
    if (dnt === '1' || dnt === 'yes') return

    try {
      await $fetch('/api/events/track', {
        method: 'POST',
        body: {
          event_type: type,
          path: window.location.pathname,
          referrer: document.referrer || null,
          metadata: metadata || {}
        }
      })
    } catch {
      // Silent fail — analytics should never break the site
    }
  }

  // Track initial page view
  void trackEvent('page_view', { path: window.location.pathname })

  // Track page views on route change
  router.afterEach((to) => {
    void trackEvent('page_view', { path: to.fullPath })
  })

  // Expose composable for manual tracking
  nuxtApp.provide('trackEvent', trackEvent)
})
