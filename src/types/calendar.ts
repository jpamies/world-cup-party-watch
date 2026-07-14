export type MatchPhase =
  | 'groups'
  | 'r32'
  | 'r16'
  | 'quarter'
  | 'semi'
  | 'final'
  | 'unknown'

export type ChannelId = 'dazn' | 'la1' | 'rtve-play'

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
  channels: ChannelId[]
  liveHomeScore?: number | null
  liveAwayScore?: number | null
  liveMatchTime?: string | null
  liveStatusLabel?: string | null
  liveHomeFlagUrl?: string | null
  liveAwayFlagUrl?: string | null
  liveIdStage?: string | null
  liveIdMatch?: string | null
  livePenaltyWinner?: 'home' | 'away' | null
  liveOfficials?: MatchOfficial[]
  liveCards?: number
  livePenalties?: number
}

// A single member of a match's officiating crew (referee, fourth official, ...).
export interface MatchOfficial {
  officialId: string
  name: string
  countryCode: string
  roleType: number
  role: string
}

export interface CalendarMatchday {
  id: string
  name: string
  phase: MatchPhase
  date: string
  matches: CalendarMatch[]
}
