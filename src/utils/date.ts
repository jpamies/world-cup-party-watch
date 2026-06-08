const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatterCache.get(timeZone)
  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  })

  dateTimeFormatterCache.set(timeZone, formatter)
  return formatter
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function formatKickoff(isoUtc: string, timeZone: string): string {
  const date = new Date(isoUtc)
  return getFormatter(timeZone).format(date)
}

export function getLocalDayKey(isoUtc: string, timeZone: string): string {
  const date = new Date(isoUtc)
  return date.toLocaleDateString('sv-SE', { timeZone })
}

export function isUpcomingMatch(isoUtc: string): boolean {
  return new Date(isoUtc).getTime() >= Date.now()
}
