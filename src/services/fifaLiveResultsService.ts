import type { CalendarMatch, MatchOfficial } from '../types/calendar'
import { getCountryFlagSrc } from '../utils/country'

const FIFA_SEASON_ID = '285023'
const FIFA_MATCHES_URL = `https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idSeason=${FIFA_SEASON_ID}`
const LIVE_RESULTS_CACHE_KEY = 'wc26:fifa-live-results:v3'
const LIVE_RESULTS_CACHE_TTL_MS = 2 * 60 * 1000

// Snapshot estático de resultados finalizados. Se usa como base inmediata
// (sin red) antes de superponer los datos en vivo de la API / localStorage.
const BASE_RESULTS_URL = `${import.meta.env.BASE_URL}data/results-snapshot.json`

interface FifaLocalizedText {
  Locale: string
  Description: string
}

interface FifaTeam {
  Score?: number | null
  PictureUrl?: string | null
  IdCountry?: string | null
  TeamName?: FifaLocalizedText[]
  Abbreviation?: string | null
  ShortClubName?: string | null
}

interface FifaOfficial {
  OfficialId?: string | null
  IdCountry?: string | null
  Name?: FifaLocalizedText[]
  NameShort?: FifaLocalizedText[]
  OfficialType?: number | null
  TypeLocalized?: FifaLocalizedText[]
}

interface FifaMatch {
  IdMatch: string
  IdStage?: string | null
  MatchNumber: number
  Date?: string | null
  Home?: FifaTeam
  Away?: FifaTeam
  HomeTeamScore?: number | null
  AwayTeamScore?: number | null
  HomeTeamPenaltyScore?: number | null
  AwayTeamPenaltyScore?: number | null
  MatchTime?: string | null
  Winner?: string | null
  ResultType?: number | null
  StageName?: FifaLocalizedText[]
  GroupName?: FifaLocalizedText[]
  Officials?: FifaOfficial[]
  YellowCards?: number | null
  RedCards?: number | null
  Penalties?: number | null
  Fouls?: number | null
  VarReviews?: number | null
  Stadium?: {
    Name?: FifaLocalizedText[]
  }
}

interface CachedLiveResults {
  fetchedAt: string
  matches: LiveMatchSnapshot[]
}

export interface LiveMatchSnapshot {
  matchNumber: number
  homeScore: number | null
  awayScore: number | null
  matchTime: string | null
  statusLabel: string | null
  homeFlagUrl: string | null
  awayFlagUrl: string | null
  idStage: string | null
  idMatch: string | null
  penaltyWinner: 'home' | 'away' | null
  officials: MatchOfficial[]
  yellowCards: number
  redCards: number
  penalties: number
  fouls: number
  varReviews: number
  updatedAt: string
}

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readCache(): CachedLiveResults | null {
  if (!isBrowserStorageAvailable()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(LIVE_RESULTS_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const candidate = parsed as Partial<CachedLiveResults>
    if (typeof candidate.fetchedAt !== 'string' || !Array.isArray(candidate.matches)) {
      return null
    }

    const matches = candidate.matches.filter((item): item is LiveMatchSnapshot => {
      if (!item || typeof item !== 'object') {
        return false
      }

      const snapshot = item as Partial<LiveMatchSnapshot>
      return typeof snapshot.matchNumber === 'number'
    })

    return {
      fetchedAt: candidate.fetchedAt,
      matches,
    }
  } catch {
    return null
  }
}

function writeCache(matches: LiveMatchSnapshot[]): void {
  if (!isBrowserStorageAvailable()) {
    return
  }

  const payload: CachedLiveResults = {
    fetchedAt: new Date().toISOString(),
    matches,
  }

  window.localStorage.setItem(LIVE_RESULTS_CACHE_KEY, JSON.stringify(payload))
}

function isFresh(cache: CachedLiveResults): boolean {
  const age = Date.now() - new Date(cache.fetchedAt).getTime()
  return Number.isFinite(age) && age >= 0 && age < LIVE_RESULTS_CACHE_TTL_MS
}

function getTeamDisplayName(team: FifaTeam | undefined): string | null {
  if (!team) {
    return null
  }

  if (team.ShortClubName) {
    return team.ShortClubName
  }

  const localized = team.TeamName?.find((item) => item.Locale.toLowerCase().startsWith('en'))
  return localized?.Description ?? team.Abbreviation ?? team.IdCountry ?? null
}

function buildFlagUrl(team: FifaTeam | undefined): string | null {
  const name = getTeamDisplayName(team)
  if (!name) {
    return null
  }

  return getCountryFlagSrc(name)
}

function toStatusLabel(match: FifaMatch): string | null {
  if (match.ResultType === 1 || match.Winner) {
    return 'FT'
  }

  if (match.MatchTime) {
    return match.MatchTime
  }

  return null
}

// Winner side of a penalty shootout, only when regular time ended level.
function toPenaltyWinner(match: FifaMatch): 'home' | 'away' | null {
  const homePens = match.HomeTeamPenaltyScore
  const awayPens = match.AwayTeamPenaltyScore
  if (homePens == null || awayPens == null || homePens === awayPens) {
    return null
  }
  return homePens > awayPens ? 'home' : 'away'
}

function localizedText(items: FifaLocalizedText[] | undefined): string | null {
  if (!items || items.length === 0) {
    return null
  }
  const en = items.find((item) => item.Locale.toLowerCase().startsWith('en'))
  return (en ?? items[0])?.Description ?? null
}

// Extracts the officiating crew (referee, fourth official, ...) from a match.
function toMatchOfficials(match: FifaMatch): MatchOfficial[] {
  const officials = match.Officials
  if (!Array.isArray(officials)) {
    return []
  }

  return officials
    .map((official): MatchOfficial | null => {
      const officialId = official.OfficialId ?? null
      const name = localizedText(official.Name) ?? localizedText(official.NameShort)
      if (!officialId || !name) {
        return null
      }
      return {
        officialId,
        name,
        countryCode: official.IdCountry ?? '',
        roleType: Number(official.OfficialType ?? 0),
        role: localizedText(official.TypeLocalized) ?? 'Official',
      }
    })
    .filter((item): item is MatchOfficial => item !== null)
}

function toLiveMatchSnapshot(match: FifaMatch): LiveMatchSnapshot {
  const homeScore = Number.isFinite(match.HomeTeamScore ?? Number.NaN)
    ? Number(match.HomeTeamScore)
    : null
  const awayScore = Number.isFinite(match.AwayTeamScore ?? Number.NaN)
    ? Number(match.AwayTeamScore)
    : null

  return {
    matchNumber: Number(match.MatchNumber),
    homeScore,
    awayScore,
    matchTime: match.MatchTime ?? null,
    statusLabel: toStatusLabel(match),
    homeFlagUrl: buildFlagUrl(match.Home),
    awayFlagUrl: buildFlagUrl(match.Away),
    idStage: match.IdStage ?? null,
    idMatch: match.IdMatch ?? null,
    penaltyWinner: toPenaltyWinner(match),
    officials: toMatchOfficials(match),
    yellowCards: Number.isFinite(match.YellowCards ?? Number.NaN)
      ? Number(match.YellowCards)
      : 0,
    redCards: Number.isFinite(match.RedCards ?? Number.NaN)
      ? Number(match.RedCards)
      : 0,
    penalties: Number.isFinite(match.Penalties ?? Number.NaN)
      ? Number(match.Penalties)
      : 0,
    fouls: Number.isFinite(match.Fouls ?? Number.NaN)
      ? Number(match.Fouls)
      : 0,
    varReviews: Number.isFinite(match.VarReviews ?? Number.NaN)
      ? Number(match.VarReviews)
      : 0,
    updatedAt: new Date().toISOString(),
  }
}

async function fetchLiveResults(): Promise<LiveMatchSnapshot[]> {
  const response = await fetch(FIFA_MATCHES_URL, { credentials: 'omit' })
  if (!response.ok) {
    throw new Error(`Unable to load FIFA live results (${response.status})`)
  }

  const raw: unknown = await response.json()
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { Results?: unknown }).Results)) {
    throw new Error('Unexpected FIFA live results format')
  }

  const results = (raw as { Results: FifaMatch[] }).Results
    .filter((item) => typeof item === 'object' && item !== null)
    .map(toLiveMatchSnapshot)
    .sort((left, right) => left.matchNumber - right.matchNumber)

  writeCache(results)
  return results
}

export async function getLiveResultsByMatchNumber(): Promise<Map<number, LiveMatchSnapshot>> {
  const cached = readCache()
  if (cached && isFresh(cached)) {
    return new Map(cached.matches.map((item) => [item.matchNumber, item]))
  }

  try {
    const liveMatches = await fetchLiveResults()
    return new Map(liveMatches.map((item) => [item.matchNumber, item]))
  } catch (error) {
    if (cached) {
      return new Map(cached.matches.map((item) => [item.matchNumber, item]))
    }

    throw error
  }
}

let baseResultsCache: Map<number, LiveMatchSnapshot> | null = null

/**
 * Carga el snapshot estático de resultados finalizados empaquetado con la app.
 * Es inmediato (fichero local, mismo origen) y sirve de base antes de pedir
 * los datos en vivo. Se cachea en memoria para no releerlo en cada llamada.
 */
export async function getBaseResultsByMatchNumber(): Promise<Map<number, LiveMatchSnapshot>> {
  if (baseResultsCache) {
    return baseResultsCache
  }

  try {
    const response = await fetch(BASE_RESULTS_URL, { credentials: 'omit', cache: 'no-cache' })
    if (!response.ok) {
      throw new Error(`Unable to load base results snapshot (${response.status})`)
    }

    const raw: unknown = await response.json()
    const results = (raw as { Results?: unknown })?.Results
    if (!Array.isArray(results)) {
      throw new Error('Unexpected base results snapshot format')
    }

    const snapshots = results
      .filter((item): item is FifaMatch => typeof item === 'object' && item !== null)
      .map(toLiveMatchSnapshot)

    baseResultsCache = new Map(snapshots.map((item) => [item.matchNumber, item]))
    return baseResultsCache
  } catch {
    return new Map()
  }
}

/**
 * Fusiona resultados: los datos en vivo sobrescriben a los de base por número
 * de partido; los de base rellenan lo que el vivo no traiga.
 */
export function mergeResults(
  base: Map<number, LiveMatchSnapshot>,
  live: Map<number, LiveMatchSnapshot>,
): Map<number, LiveMatchSnapshot> {
  const merged = new Map(base)
  for (const [matchNumber, snapshot] of live) {
    const baseSnapshot = base.get(matchNumber)
    // El endpoint en vivo no trae oficiales/tarjetas/penaltis completos;
    // conservamos los del snapshot base cuando el vivo no los aporta.
    merged.set(matchNumber, {
      ...snapshot,
      officials: snapshot.officials.length ? snapshot.officials : baseSnapshot?.officials ?? [],
      yellowCards: snapshot.yellowCards || baseSnapshot?.yellowCards || 0,
      redCards: snapshot.redCards || baseSnapshot?.redCards || 0,
      penalties: snapshot.penalties || baseSnapshot?.penalties || 0,
      fouls: snapshot.fouls || baseSnapshot?.fouls || 0,
      varReviews: snapshot.varReviews || baseSnapshot?.varReviews || 0,
    })
  }
  return merged
}

export function enrichCalendarMatches(matches: CalendarMatch[], liveMatches: Map<number, LiveMatchSnapshot>): CalendarMatch[] {
  return matches.map((match) => {
    const live = liveMatches.get(match.matchNumber)
    if (!live) {
      return match
    }

    return {
      ...match,
      liveHomeScore: live.homeScore,
      liveAwayScore: live.awayScore,
      liveMatchTime: live.matchTime,
      liveStatusLabel: live.statusLabel,
      liveHomeFlagUrl: live.homeFlagUrl,
      liveAwayFlagUrl: live.awayFlagUrl,
      liveIdStage: live.idStage,
      liveIdMatch: live.idMatch,
      livePenaltyWinner: live.penaltyWinner,
      liveOfficials: live.officials,
      liveYellowCards: live.yellowCards,
      liveRedCards: live.redCards,
      livePenalties: live.penalties,
      liveFouls: live.fouls,
      liveVarReviews: live.varReviews,
    }
  })
}