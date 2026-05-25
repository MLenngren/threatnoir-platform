import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  return {
    schema_version: 'v1',
    name_for_human: 'ThreatNoir Threat Intelligence',
    name_for_model: 'threatnoir',
    description_for_human: 'Search cybersecurity IOCs, articles, and threat intelligence from ThreatNoir.',
    description_for_model:
      "Search and retrieve indicators of compromise (IOCs), security articles, weekly threat roundups, active focus items (advisories), and awareness lessons from ThreatNoir's curated cybersecurity database. Supports IP, domain, hash, CVE, and MITRE ATT&CK lookups.",
    auth: { type: 'none' },
    api: {
      type: 'openapi',
      url: 'https://threatnoir.com/api/openapi.json'
    },
      logo_url: 'https://threatnoir.com/icon.svg',
    contact_email: process.env.CONTACT_EMAIL || 'contact@example.com',
    legal_info_url: 'https://threatnoir.com'
  }
})
