import type { CalendarMatch } from '../types/calendar'

function formatUtcDate(dateValue: string): string {
  const date = new Date(dateValue)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hour}${minute}${second}Z`
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function buildFavoritesCalendarInvite(matches: CalendarMatch[]): string {
  const now = formatUtcDate(new Date().toISOString())
  const sorted = [...matches].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))

  const events = sorted
    .map((match) => {
      const start = formatUtcDate(match.kickoffUtc)
      const endDate = new Date(match.kickoffUtc)
      endDate.setHours(endDate.getHours() + 2)
      const end = formatUtcDate(endDate.toISOString())

      const summary = `${match.home} vs ${match.away}`
      const description = `World Cup Party Watch\\nGroup: ${match.group ?? 'N/A'}\\nBroadcast: ${match.channels.join(', ')}`

      return [
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(match.id)}@world-cup-party-watch`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `LOCATION:${escapeIcsText(match.location)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'END:VEVENT',
      ].join('\r\n')
    })
    .join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//World Cup Party Watch//Favorites//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadInviteFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
