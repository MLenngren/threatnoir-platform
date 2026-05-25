/**
 * ISO week helpers (UTC).
 * Week starts Monday; week 1 is the week containing the first Thursday.
 */

export function startOfIsoWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() || 7 // 1..7, Monday=1
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export function isoWeekLabel(date: Date): string {
  // ISO week: week starts Monday; week 1 is the one containing the first Thursday.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow) // nearest Thursday

  const weekYear = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${weekYear}-W${String(weekNo).padStart(2, '0')}`
}
