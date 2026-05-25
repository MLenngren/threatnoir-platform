type IsoDate = `${number}-${number}-${number}`

const ISO_DATE_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/

export type WeekRange = {
  start: Date
  end: Date
  startIso: IsoDate
  endIso: IsoDate
}

export function parseIsoDateToUtcDate(iso: string): Date | null {
  const m = ISO_DATE_RE.exec((iso || '').trim())
  if (!m) return null

  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year) return null
  if (d.getUTCMonth() !== month - 1) return null
  if (d.getUTCDate() !== day) return null
  return d
}

export function formatIsoDateUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function startOfWeekMondayUtc(date: Date): Date {
  const d = startOfDayUtc(date)
  // JS: 0=Sun, 1=Mon, ... 6=Sat
  const day = d.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  return addDaysUtc(d, -daysSinceMonday)
}

export function getWeekRangeUtc(date: Date): WeekRange {
  const start = startOfWeekMondayUtc(date)
  const end = addDaysUtc(start, 6)
  return {
    start,
    end,
    startIso: formatIsoDateUtc(start),
    endIso: formatIsoDateUtc(end)
  }
}

export function getWeekRangeFromMondayIso(mondayIso: string): WeekRange | null {
  const d = parseIsoDateToUtcDate(mondayIso)
  if (!d) return null
  return getWeekRangeUtc(d)
}

export function formatWeekRange(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()

  const startSameYear = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  })

  if (sameMonth) {
    const endDayYear = end.toLocaleDateString('en-US', {
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
    return `${startSameYear} – ${endDayYear}`
  }

  if (sameYear) {
    const endMonthDayYear = end.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
    return `${startSameYear} – ${endMonthDayYear}`
  }

  const startMonthDayYear = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
  const endMonthDayYear = end.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
  return `${startMonthDayYear} – ${endMonthDayYear}`
}

export function formatWeekLabel(range: WeekRange): string {
  return `Week of ${formatWeekRange(range.start, range.end)}`
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

export function useWeekNav() {
  const route = useRoute()

  const requestedWeek = computed(() => firstQueryValue(route.query.week))

  const range = computed<WeekRange>(() => {
    const parsed = parseIsoDateToUtcDate(requestedWeek.value)
    return parsed ? getWeekRangeUtc(parsed) : getWeekRangeUtc(new Date())
  })

  const weekStartIso = computed(() => range.value.startIso)
  const weekEndIso = computed(() => range.value.endIso)

  const prevWeekIso = computed(() => formatIsoDateUtc(addDaysUtc(range.value.start, -7)))
  const nextWeekIso = computed(() => formatIsoDateUtc(addDaysUtc(range.value.start, 7)))

  const label = computed(() => formatWeekLabel(range.value))

  return {
    range,
    weekStartIso,
    weekEndIso,
    prevWeekIso,
    nextWeekIso,
    label
  }
}
