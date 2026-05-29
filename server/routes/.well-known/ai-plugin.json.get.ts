import { defineEventHandler, setResponseHeader } from 'h3'
import { getSiteConfig } from '../../utils/siteConfig'

export default defineEventHandler((event) => {
	const site = getSiteConfig()
	const modelName = String(site.name || 'site')
	  .toLowerCase()
	  .replace(/[^a-z0-9]+/g, '_')
	  .replace(/^_+|_+$/g, '')
	  .slice(0, 40) || 'site'

  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  return {
    schema_version: 'v1',
	  name_for_human: `${site.name} Threat Intelligence`,
	  name_for_model: modelName,
	  description_for_human: `Search cybersecurity IOCs, articles, and threat intelligence from ${site.name}.`,
    description_for_model:
	    `Search and retrieve indicators of compromise (IOCs), security articles, weekly threat roundups, active focus items (advisories), and awareness lessons from ${site.name}'s curated cybersecurity database. Supports IP, domain, hash, CVE, and MITRE ATT&CK lookups.`,
    auth: { type: 'none' },
    api: {
      type: 'openapi',
	    url: `${site.url}/api/openapi.json`
    },
	    logo_url: `${site.url}/icon.svg`,
	    contact_email: process.env.NUXT_PUBLIC_CONTACT_EMAIL || 'contact@example.com',
	  legal_info_url: site.url
  }
})
