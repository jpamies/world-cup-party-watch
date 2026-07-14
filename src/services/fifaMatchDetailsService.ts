const FIFA_COMPETITION_ID = '17'
const FIFA_SEASON_ID = '285023'

interface FifaLocalizedText {
  Locale: string
  Description: string
}

interface FifaGoal {
  Type?: number | null
  IdPlayer?: string | null
  Minute?: string | null
}

interface FifaBooking {
  Card?: number | null
  IdPlayer?: string | null
  Minute?: string | null
}

interface FifaPlayer {
  IdPlayer?: string | null
  PlayerName?: FifaLocalizedText[]
  ShortName?: FifaLocalizedText[]
}

interface FifaLiveTeam {
  Score?: number | null
  ShortClubName?: string | null
  Abbreviation?: string | null
  TeamName?: FifaLocalizedText[]
  Players?: FifaPlayer[]
  Goals?: FifaGoal[]
  Bookings?: FifaBooking[]
}

interface FifaLiveMatch {
  HomeTeam?: FifaLiveTeam
  AwayTeam?: FifaLiveTeam
  Winner?: string | null
  ResultType?: number | null
  Officials?: FifaOfficial[]
}

interface FifaOfficial {
  OfficialId?: string | null
  IdCountry?: string | null
  Name?: FifaLocalizedText[]
  NameShort?: FifaLocalizedText[]
  OfficialType?: number | null
  TypeLocalized?: FifaLocalizedText[]
}

export type MatchEventSide = 'home' | 'away'

export interface GoalEvent {
  side: MatchEventSide
  player: string
  minute: string
  ownGoal: boolean
  penalty: boolean
}

export interface CardEvent {
  side: MatchEventSide
  player: string
  minute: string
  card: 'yellow' | 'red'
}

export interface OfficialInfo {
  name: string
  role: string
  countryCode: string
}

export interface MatchDetails {
  homeName: string
  awayName: string
  homeScore: number | null
  awayScore: number | null
  goals: GoalEvent[]
  cards: CardEvent[]
  officials: OfficialInfo[]
}

function localized(items: FifaLocalizedText[] | undefined): string | null {
  if (!items || items.length === 0) return null
  const en = items.find((item) => item.Locale.toLowerCase().startsWith('en'))
  return (en ?? items[0])?.Description ?? null
}

function teamName(team: FifaLiveTeam | undefined): string {
  if (!team) return '—'
  return team.ShortClubName ?? localized(team.TeamName) ?? team.Abbreviation ?? '—'
}

function buildPlayerLookup(team: FifaLiveTeam | undefined): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const player of team?.Players ?? []) {
    if (!player.IdPlayer) continue
    const name = localized(player.ShortName) ?? localized(player.PlayerName)
    if (name) lookup.set(player.IdPlayer, name)
  }
  return lookup
}

// FIFA goal Type: 2 = regular, 3 = penalty, 4 = own goal (best-effort mapping).
function mapGoals(team: FifaLiveTeam | undefined, side: MatchEventSide): GoalEvent[] {
  const lookup = buildPlayerLookup(team)
  return (team?.Goals ?? []).map((goal) => ({
    side,
    player: (goal.IdPlayer ? lookup.get(goal.IdPlayer) : null) ?? 'Gol',
    minute: goal.Minute ?? '',
    ownGoal: goal.Type === 4,
    penalty: goal.Type === 3,
  }))
}

// FIFA booking Card: 1 = yellow, 2 = second yellow (red), 3 = straight red.
function mapCards(team: FifaLiveTeam | undefined, side: MatchEventSide): CardEvent[] {
  const lookup = buildPlayerLookup(team)
  return (team?.Bookings ?? []).map((booking) => ({
    side,
    player: (booking.IdPlayer ? lookup.get(booking.IdPlayer) : null) ?? '—',
    minute: booking.Minute ?? '',
    card: booking.Card === 1 ? 'yellow' : 'red',
  }))
}

function minuteValue(minute: string): number {
  const match = minute.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

const ROLE_LABELS_ES: Record<number, string> = {
  1: 'Árbitro',
  2: 'Asistente',
  3: 'Asistente',
  4: '4º árbitro',
  5: 'VAR',
  6: 'AVAR',
}

function mapOfficials(officials: FifaOfficial[] | undefined): OfficialInfo[] {
  return (officials ?? [])
    .map((official) => {
      const name = localized(official.NameShort) ?? localized(official.Name)
      if (!name) return null
      const type = official.OfficialType ?? 0
      const role =
        ROLE_LABELS_ES[type] ?? localized(official.TypeLocalized) ?? 'Oficial'
      return { name, role, countryCode: official.IdCountry ?? '' }
    })
    .filter((info): info is OfficialInfo => info !== null)
    .sort((a, b) => a.role.localeCompare(b.role))
}

export async function getMatchDetails(
  idStage: string,
  idMatch: string,
): Promise<MatchDetails> {
  const url = `https://api.fifa.com/api/v3/live/football/${FIFA_COMPETITION_ID}/${FIFA_SEASON_ID}/${idStage}/${idMatch}?language=en`
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) {
    throw new Error(`No se pudo cargar el detalle del partido (${response.status})`)
  }

  const data = (await response.json()) as FifaLiveMatch
  const home = data.HomeTeam
  const away = data.AwayTeam

  const goals = [...mapGoals(home, 'home'), ...mapGoals(away, 'away')].sort(
    (a, b) => minuteValue(a.minute) - minuteValue(b.minute),
  )
  const cards = [...mapCards(home, 'home'), ...mapCards(away, 'away')].sort(
    (a, b) => minuteValue(a.minute) - minuteValue(b.minute),
  )

  return {
    homeName: teamName(home),
    awayName: teamName(away),
    homeScore: home?.Score ?? null,
    awayScore: away?.Score ?? null,
    goals,
    cards,
    officials: mapOfficials(data.Officials),
  }
}
