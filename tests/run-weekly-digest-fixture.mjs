import { readFileSync } from 'node:fs'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url, { esmResolve: true, interopDefault: true })

const { renderWeeklyDigest } = jiti('../server/utils/email/weeklyDigest.ts')

const md = readFileSync('tests/fixtures/weekly-digest-w19-loose-list.md', 'utf8')

try {
  const rendered = renderWeeklyDigest({
    email: 't@example.com',
    siteUrl: 'https://threatnoir.com',
    unsubscribeUrl: 'https://threatnoir.com/unsubscribe',
    weekLabel: 'Week 19, 2026',
    weeklySlug: null,
    weeklyTldr: md,
    executiveSummary: '',
    tagline: '',
    coverImageUrl: '',
    focusItems: [],
    awarenessLesson: null,
    latestPodcast: null,
    upcomingEvents: []
  })

  if (!rendered?.html || typeof rendered.html !== 'string') {
    throw new Error('renderWeeklyDigest did not return html string')
  }
  if (!rendered.html.includes('<li')) {
    throw new Error('renderWeeklyDigest output did not contain <li> (expected list rendering)')
  }

  console.log('OK: weekly digest fixture rendered without throwing')
  process.exit(0)
} catch (err) {
  console.error('FAIL: weekly digest fixture render threw:', err)
  process.exit(1)
}
