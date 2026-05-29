import { defineEventHandler, setResponseHeader } from 'h3'

import { getSiteConfig } from '../utils/siteConfig'

export default defineEventHandler((event) => {
  const site = getSiteConfig()

  const body = [
    'User-Agent: *',
    'Disallow: /auth/',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /settings',
    'Disallow: /confirm',
    '',
    'User-Agent: Googlebot',
    'Allow: /api/podcast/feed.xml',
    'Allow: /api/weekly/feed.xml',
    '',
    `Sitemap: ${site.url}/sitemap.xml`,
    ''
  ].join('\n')

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  // Robots is cheap to cache, but should update quickly if operator changes config.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return body
})
