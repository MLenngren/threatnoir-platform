import { DEFAULT_SITE_NAME, DEFAULT_SITE_TAGLINE, DEFAULT_SITE_URL } from '../../shared/siteDefaults'

export function getSiteConfig() {
  const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')

  return {
    name: process.env.NUXT_PUBLIC_SITE_NAME || DEFAULT_SITE_NAME,
    tagline: process.env.NUXT_PUBLIC_SITE_TAGLINE || DEFAULT_SITE_TAGLINE,
    url: siteUrl,
    logoUrl: process.env.NUXT_PUBLIC_SITE_LOGO_URL || `${siteUrl}/site-logo.png`,
    ogImageUrl: process.env.NUXT_PUBLIC_SITE_OG_IMAGE_URL || `${siteUrl}/images/category-default.png`,
    podcastArtworkUrl: process.env.NUXT_PUBLIC_PODCAST_ARTWORK_URL || `${siteUrl}/podcast-artwork.jpg`,
    socialSameAs: [
      process.env.NUXT_PUBLIC_SOCIAL_X_URL,
      process.env.NUXT_PUBLIC_SOCIAL_LINKEDIN_URL,
      process.env.NUXT_PUBLIC_SOCIAL_GITHUB_URL
    ].filter((u): u is string => !!u),
    operatorLegalName: process.env.NUXT_PUBLIC_OPERATOR_LEGAL_NAME || ''
  }
}
