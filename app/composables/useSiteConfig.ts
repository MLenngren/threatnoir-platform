export function useSiteConfig() {
  const cfg = useRuntimeConfig().public
  const siteUrl = (cfg.siteUrl as string).replace(/\/+$/, '')

  return {
    name: cfg.siteName as string,
    tagline: cfg.siteTagline as string,
    url: siteUrl,
    logoUrl: (cfg.siteLogoUrl as string) || `${siteUrl}/site-logo.png`,
    ogImageUrl: (cfg.siteOgImageUrl as string) || `${siteUrl}/images/category-default.png`,
    podcastArtworkUrl: (cfg.podcastArtworkUrl as string) || `${siteUrl}/podcast-artwork.jpg`,
    socialSameAs: [
      cfg.socialXUrl as string,
      cfg.socialLinkedinUrl as string,
      cfg.socialGithubUrl as string
    ].filter((u): u is string => !!u && typeof u === 'string'),
    operatorLegalName: cfg.operatorLegalName as string
  }
}
