export function useOrganizationSchema() {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: site.logoUrl,
    sameAs: site.socialSameAs,
    description: site.tagline
  }
}

export function useWebSiteSchema() {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: site.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site.url}/feed?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  }
}

export function useNewsArticleSchema(article: {
  title: string
  description?: string | null
  url: string
  published_at?: string | null
  image_url?: string | null
  author?: string | null
}) {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.description || undefined,
    datePublished: article.published_at || undefined,
    dateModified: article.published_at || undefined,
    image: article.image_url || site.ogImageUrl,
    author: {
      '@type': 'Organization',
      name: site.name
    },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: {
        '@type': 'ImageObject',
        url: site.logoUrl
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url
    }
  }
}

export function usePodcastSeriesSchema() {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: `${site.name} Daily`,
    url: `${site.url}/podcast`,
    description: 'Your daily 5-minute security briefing. Two editions per day.',
    webFeed: `${site.url}/api/podcast/feed.xml`,
    author: {
      '@type': 'Organization',
      name: site.name
    },
    inLanguage: 'en'
  }
}

export function usePodcastEpisodeSchema(ep: {
  title: string
  description?: string | null
  date: string
  audio_url: string
  duration_seconds?: number | null
}) {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: ep.title,
    description: ep.description || undefined,
    datePublished: ep.date,
    url: `${site.url}/podcast`,
    associatedMedia: {
      '@type': 'MediaObject',
      contentUrl: ep.audio_url
    },
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: `${site.name} Daily`,
      url: `${site.url}/podcast`
    }
  }
}

export function useBlogPostingSchema(lesson: {
  title: string
  description?: string | null
  slug: string
  published_at?: string | null
  updated_at?: string | null
}) {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: lesson.title,
    description: lesson.description || undefined,
    datePublished: lesson.published_at || undefined,
    dateModified: lesson.updated_at || lesson.published_at || undefined,
    image: `${site.url}/og-awareness.png`,
    author: {
      '@type': 'Organization',
      name: site.name
    },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: {
        '@type': 'ImageObject',
        url: site.logoUrl
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${site.url}/awareness/${lesson.slug}`
    }
  }
}

export function useEventSchema(event: {
  title: string
  description?: string | null
  slug: string
  start_date: string
  end_date?: string | null
  location?: string | null
  is_virtual?: boolean | null
  organizer?: string | null
  url?: string | null
}) {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || undefined,
    startDate: event.start_date,
    endDate: event.end_date || event.start_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.is_virtual
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: event.is_virtual
      ? {
          '@type': 'VirtualLocation',
          url: event.url || `${site.url}/events`
        }
      : {
          '@type': 'Place',
          name: event.location || 'In-Person',
          address: event.location || undefined
        },
    organizer: event.organizer
      ? {
          '@type': 'Organization',
          name: event.organizer
        }
      : undefined,
    url: event.url || `${site.url}/events`
  }
}

export function useBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url
    }))
  }
}

export function useCollectionPageSchema(opts: { name: string; url: string; description: string }) {
  const site = useSiteConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    url: opts.url,
    description: opts.description,
    isPartOf: { '@type': 'WebSite', url: site.url, name: site.name }
  }
}
