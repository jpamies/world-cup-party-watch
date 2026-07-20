import type { CalendarMatch, MatchCardEvent, MatchGoalEvent } from '../types/calendar'

export type MatchEventSide = 'home' | 'away'

export type GoalEvent = MatchGoalEvent
export type CardEvent = MatchCardEvent

export interface OfficialInfo {
  name: string
  role: string
  countryCode: string
}

export interface MatchDetails {
  goals: GoalEvent[]
  cards: CardEvent[]
  officials: OfficialInfo[]
}

const ROLE_LABELS_ES: Record<number, string> = {
  1: 'Árbitro',
  2: 'Asistente',
  3: 'Asistente',
  4: '4º árbitro',
  5: 'VAR',
  6: 'AVAR',
}

function minuteValue(minute: string): number {
  const match = minute.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

/**
 * Construye el detalle de un partido (goles, tarjetas, árbitros) a partir de
 * los datos ya presentes en el snapshot estático empaquetado con la app.
 * No hace ninguna petición de red: funciona 100% offline.
 */
export function buildMatchDetails(match: CalendarMatch): MatchDetails {
  const goals = [...(match.liveGoals ?? [])].sort(
    (a, b) => minuteValue(a.minute) - minuteValue(b.minute),
  )
  const cards = [...(match.liveCards ?? [])].sort(
    (a, b) => minuteValue(a.minute) - minuteValue(b.minute),
  )
  const officials: OfficialInfo[] = (match.liveOfficials ?? [])
    .map((official) => ({
      name: official.name,
      role: ROLE_LABELS_ES[official.roleType] ?? official.role,
      countryCode: official.countryCode,
    }))
    .sort((a, b) => a.role.localeCompare(b.role))

  return { goals, cards, officials }
}
