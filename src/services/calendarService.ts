import type { CalendarMatch, CalendarMatchday, MatchPhase } from '../types/calendar'

interface RawMatch {
  id: string
  match_number?: number
  home?: string
  away?: string
  kickoff?: string
  location?: string
  group?: string
}

interface RawMatchday {
  id: string
  name?: string
  phase?: string
  date?: string
  matches?: RawMatch[]
}

const PHASE_MAP: Record<string, MatchPhase> = {
  groups: 'groups',
  r32: 'r32',
  r16: 'r16',
  quarter: 'quarter',
  semi: 'semi',
  final: 'final',
}

function normalizePhase(value: string | undefined): MatchPhase {
  if (!value) {
    return 'unknown'
  }

  const normalized = value.trim().toLowerCase()
  return PHASE_MAP[normalized] ?? 'unknown'
}

export async function getCalendarMatchdays(): Promise<CalendarMatchday[]> {
  const response = await fetch('./data/calendar.json')
  if (!response.ok) {
    throw new Error('Unable to load calendar.json')
  }

  const raw: unknown = await response.json()
  if (!Array.isArray(raw)) {
    throw new Error('calendar.json has an invalid format')
  }

  const matchdays = raw
    .filter((item): item is RawMatchday => typeof item === 'object' && item !== null)
    .map((matchday): CalendarMatchday => {
      const phase = normalizePhase(matchday.phase)
      const matches = (matchday.matches ?? [])
        .filter((match): match is RawMatch => typeof match === 'object' && match !== null)
        .map(
          (match): CalendarMatch => ({
            id: String(match.id),
            matchNumber: Number(match.match_number ?? 0),
            home: String(match.home ?? 'TBD'),
            away: String(match.away ?? 'TBD'),
            kickoffUtc: String(match.kickoff ?? ''),
            location: String(match.location ?? 'Unknown venue'),
            group: match.group,
            phase,
            matchdayId: String(matchday.id),
            matchdayName: String(matchday.name ?? matchday.id),
          }),
        )
        .filter((match) => Number.isFinite(new Date(match.kickoffUtc).getTime()))
        .sort(
          (left, right) =>
            new Date(left.kickoffUtc).getTime() - new Date(right.kickoffUtc).getTime(),
        )

      return {
        id: String(matchday.id),
        name: String(matchday.name ?? matchday.id),
        phase,
        date: String(matchday.date ?? ''),
        matches,
      }
    })

  return matchdays
}

export async function getCalendarMatches(): Promise<CalendarMatch[]> {
  const matchdays = await getCalendarMatchdays()

  return matchdays
    .flatMap((matchday) => matchday.matches)
    .sort(
      (left, right) =>
        new Date(left.kickoffUtc).getTime() - new Date(right.kickoffUtc).getTime(),
    )
}
