export function useOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ThreatNoir',
    url: 'https://threatnoir.com',
    logo: 'https://threatnoir.com/images/threatnoir-logo-wide.png',
    sameAs: ['https://x.com/lenngrenm', 'https://www.linkedin.com/in/marcuslenngren'],
    description: 'Curated security intelligence for SOC analysts, threat hunters, and security leaders.'
  }
}

export function useWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ThreatNoir',
    url: 'https://threatnoir.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://threatnoir.com/feed?q={search_term_string}'
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
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.description || undefined,
    datePublished: article.published_at || undefined,
    dateModified: article.published_at || undefined,
    image: article.image_url || 'https://threatnoir.com/images/category-default.png',
    author: {
      '@type': 'Organization',
      name: 'ThreatNoir'
    },
    publisher: {
      '@type': 'Organization',
      name: 'ThreatNoir',
      logo: {
        '@type': 'ImageObject',
        url: 'https://threatnoir.com/images/threatnoir-logo-wide.png'
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url
    }
  }
}

export function usePodcastSeriesSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: 'ThreatNoir Daily',
    url: 'https://threatnoir.com/podcast',
    description: 'Your daily 5-minute security briefing. Two editions per day.',
    webFeed: 'https://threatnoir.com/api/podcast/feed.xml',
    author: {
      '@type': 'Organization',
      name: 'ThreatNoir'
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
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    name: ep.title,
    description: ep.description || undefined,
    datePublished: ep.date,
    url: `https://threatnoir.com/podcast`,
    associatedMedia: {
      '@type': 'MediaObject',
      contentUrl: ep.audio_url
    },
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: 'ThreatNoir Daily',
      url: 'https://threatnoir.com/podcast'
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
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: lesson.title,
    description: lesson.description || undefined,
    datePublished: lesson.published_at || undefined,
    dateModified: lesson.updated_at || lesson.published_at || undefined,
    image: 'https://threatnoir.com/og-awareness.png',
    author: {
      '@type': 'Organization',
      name: 'ThreatNoir'
    },
    publisher: {
      '@type': 'Organization',
      name: 'ThreatNoir',
      logo: {
        '@type': 'ImageObject',
        url: 'https://threatnoir.com/images/threatnoir-logo-wide.png'
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://threatnoir.com/awareness/${lesson.slug}`
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
          url: event.url || `https://threatnoir.com/events`
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
    url: event.url || `https://threatnoir.com/events`
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
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    url: opts.url,
    description: opts.description,
    isPartOf: { '@type': 'WebSite', url: 'https://threatnoir.com', name: 'ThreatNoir' }
  }
}
