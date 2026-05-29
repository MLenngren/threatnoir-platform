import { createError } from 'h3'

import { getSiteConfig } from './siteConfig'

const isProd = process.env.NODE_ENV === 'production'

function resolveEmail(varName: string, fallbacks: string[], purpose: string): string {
  const specific = (process.env[varName] || '').trim()
  if (specific) return specific

  for (const fb of fallbacks) {
    const v = (process.env[fb] || '').trim()
    if (v) {
      if (isProd) {
        throw createError({
          statusCode: 500,
          statusMessage: `${purpose}: ${varName} not set (env required in production)`
        })
      }
      console.warn(
        `[emailConfig] ${varName} not set; falling back to ${fb} (${purpose}). DO NOT rely on this in production.`
      )
      return v
    }
  }

  if (isProd) {
    throw createError({
      statusCode: 500,
      statusMessage: `${purpose}: no recipient configured (${varName}${fallbacks.length ? ` or ${fallbacks.join('/')}` : ''})`
    })
  }

  console.warn(`[emailConfig] ${varName} not set and no fallback. Using example placeholder. ${purpose}.`)
  return 'admin@example.com'
}

export const emailRecipients = {
  // Use-case recipients (operators should set these explicitly in production)
  contactForm: () => resolveEmail('CONTACT_FORM_RECIPIENT', ['ADMIN_EMAIL'], 'contact form'),
  linkedinDraft: () => resolveEmail('LINKEDIN_DRAFT_RECIPIENT', ['ADMIN_EMAIL'], 'LinkedIn weekly draft'),
  podcastOwner: () => resolveEmail('PODCAST_OWNER_EMAIL', ['ADMIN_EMAIL'], 'podcast iTunes feed owner'),
  weeklyDigestPreview: () => resolveEmail('WEEKLY_DIGEST_PREVIEW_TO', ['ADMIN_EMAIL'], 'weekly digest preview'),
  previewFixture: () => resolveEmail('PREVIEW_EMAIL_FIXTURE', ['ADMIN_EMAIL'], 'admin preview email fixture'),

  // Generic admin notification recipient (used by notifyAdmin)
  adminNotifications: () => resolveEmail('ADMIN_EMAIL', [], 'admin notifications')
}

function defaultSender(): string {
  const site = getSiteConfig()
  return (process.env.EMAIL_FROM || '').trim() || `${site.name} <noreply@example.com>`
}

export const emailSenders = {
  default: () => defaultSender(),
  welcome: () => (process.env.EMAIL_FROM_WELCOME || '').trim() || defaultSender(),
  notifications: () => (process.env.EMAIL_FROM_NOTIFICATIONS || '').trim() || defaultSender()
}
