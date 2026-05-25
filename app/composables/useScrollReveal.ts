type ScrollRevealOptions = {
  rootMargin?: string
  threshold?: number
  once?: boolean
}

export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const el = ref<HTMLElement | null>(null)
  const revealed = ref(false)

  const rootMargin = options.rootMargin ?? '0px 0px -10% 0px'
  const threshold = options.threshold ?? 0.1
  const once = options.once ?? true

  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (revealed.value) return
    if (!el.value) {
      revealed.value = true
      return
    }

    // If browser doesn't support IntersectionObserver, just show content.
    if (!('IntersectionObserver' in window)) {
      revealed.value = true
      return
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          revealed.value = true
          if (once && observer) observer.disconnect()
          break
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(el.value)
  })

  onBeforeUnmount(() => {
    if (observer) observer.disconnect()
    observer = null
  })

  return { el, revealed }
}
