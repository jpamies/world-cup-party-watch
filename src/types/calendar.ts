export type MatchPhase =
  | 'groups'
  | 'r32'
  | 'r16'
  | 'quarter'
  | 'semi'
  | 'final'
  | 'unknown'

export interface CalendarMatch {
  id: string
  matchNumber: number
  home: string
  away: string
  kickoffUtc: string
  location: string
  group: string | undefined
  phase: MatchPhase
  matchdayId: string
  matchdayName: string
}

export interface CalendarMatchday {
  id: string
  name: string
  phase: MatchPhase
  date: string
  matches: CalendarMatch[]
}
