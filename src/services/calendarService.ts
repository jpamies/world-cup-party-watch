import type {
  CalendarMatch,
  CalendarMatchday,
  ChannelId,
  MatchPhase,
} from '../types/calendar'
import { enrichCalendarMatches, getBaseResultsByMatchNumber } from './fifaLiveResultsService'

interface RawMatch {
  id: string
  match_number?: number
  home?: string
  away?: string
  kickoff?: string
  location?: string
  group?: string
  channels?: string[]
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

const KNOWN_CHANNELS: Record<string, ChannelId> = {
  dazn: 'dazn',
  la1: 'la1',
  'la 1': 'la1',
  tve: 'la1',
  rtve: 'rtve-play',
  'rtve play': 'rtve-play',
}

const OPEN_TV_GROUP_PAIRS = new Set<string>([
  'canada|bosniaherzegovina',
  'brazil|morocco',
  'germany|curacao',
  'spain|caboverde',
  'france|senegal',
  'england|croatia',
  'switzerland|bosniaherzegovina',
  'usa|australia',
  'netherlands|sweden',
  'spain|saudiarabia',
  'argentina|austria',
  'england|ghana',
  'scotland|brazil',
  'ecuador|germany',
  'uruguay|spain',
  // Opening match appears in article with extra note text.
  'mexico|southafrica',
])

const COUNTRY_ALIAS_MAP: Record<string, string> = {
  us: 'usa',
  usa: 'usa',
  qatar: 'qatar',
  coteivoire: 'cotedivoire',
  cotedivoire: 'cotedivoire',
  republicademocraticadelcongo: 'congodr',
}

function normalizeCountryToken(value: string): string {
  const raw = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

  return COUNTRY_ALIAS_MAP[raw] ?? raw
}

function shouldBeOpenTvInGroups(match: RawMatch): boolean {
  const home = normalizeCountryToken(String(match.home ?? ''))
  const away = normalizeCountryToken(String(match.away ?? ''))
  return OPEN_TV_GROUP_PAIRS.has(`${home}|${away}`)
}

function inferChannels(match: RawMatch, phase: MatchPhase): ChannelId[] {
  const explicit = (match.channels ?? [])
    .map((item) => item.trim().toLowerCase())
    .map((item) => KNOWN_CHANNELS[item])
    .filter((item): item is ChannelId => Boolean(item))

  if (explicit.length > 0) {
    const normalized = new Set(explicit)

    // In Spanish coverage these usually go together in the schedule cards.
    if (normalized.has('la1') || normalized.has('rtve-play')) {
      normalized.add('la1')
      normalized.add('rtve-play')
    }

    return [...normalized]
  }

  const channels: ChannelId[] = ['dazn']

  if (phase === 'groups' && shouldBeOpenTvInGroups(match)) {
    channels.push('la1')
    channels.push('rtve-play')
  }

  if (phase === 'semi' || phase === 'final') {
    channels.push('la1')
    channels.push('rtve-play')
  }

  return [...new Set(channels)]
}

function normalizePhase(value: string | undefined): MatchPhase {
  if (!value) {
    return 'unknown'
  }

  const normalized = value.trim().toLowerCase()
  return PHASE_MAP[normalized] ?? 'unknown'
}

export async function getCalendarMatchdays(): Promise<CalendarMatchday[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/calendar.json`)
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
            channels: inferChannels(match, phase),
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

  const matches = matchdays
    .flatMap((matchday) => matchday.matches)
    .sort(
      (left, right) =>
        new Date(left.kickoffUtc).getTime() - new Date(right.kickoffUtc).getTime(),
    )

  // Datos 100% estáticos: el snapshot empaquetado con la app ya incluye
  // resultados, árbitros y eventos. No se consulta la API de la FIFA en runtime.
  const baseResults = await getBaseResultsByMatchNumber()

  return enrichCalendarMatches(matches, baseResults)
}
