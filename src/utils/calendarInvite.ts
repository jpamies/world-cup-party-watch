import type { CalendarMatch } from '../types/calendar'
import { getCountryFlagEmoji } from './country'

const CHANNEL_LABELS: Record<string, string> = {
  dazn: 'DAZN',
  la1: 'La 1 TVE',
  'rtve-play': 'RTVE Play',
}

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

export function buildFavoritesCalendarInvite(
  matches: CalendarMatch[],
  selectionName = 'My Favorites',
): string {
  const now = formatUtcDate(new Date().toISOString())
  const sorted = [...matches].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))

  const events = sorted
    .map((match) => {
      const start = formatUtcDate(match.kickoffUtc)
      const endDate = new Date(match.kickoffUtc)
      endDate.setHours(endDate.getHours() + 2)
      const end = formatUtcDate(endDate.toISOString())

      const homeFlag = getCountryFlagEmoji(match.home) ?? ''
      const awayFlag = getCountryFlagEmoji(match.away) ?? ''
      const summary = `${homeFlag} ${match.home} vs ${awayFlag} ${match.away}`
        .replace(/\s+/g, ' ')
        .trim()
      const channelLabels = match.channels
        .map((channel) => CHANNEL_LABELS[channel] ?? channel)
        .join(', ')
      const description = [
        `Selection: ${selectionName.trim() || 'My Favorites'}`,
        'World Cup Party Watch',
        `Group: ${match.group ?? 'N/A'}`,
        `Broadcast: ${channelLabels}`,
      ].join('\\n')

      return [
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(match.id)}@world-cup-party-watch`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `LOCATION:${escapeIcsText(match.location)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(`Kickoff soon: ${summary}`)}`,
        'END:VALARM',
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
