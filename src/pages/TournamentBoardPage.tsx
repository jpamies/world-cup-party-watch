import { useEffect, useMemo, useState } from 'react'
import { useCalendarData } from '../hooks/useCalendarData'
import { useTimezone } from '../hooks/useTimezone'
import { formatKickoff } from '../utils/date'
import type { CalendarMatch } from '../types/calendar'
import {
  getCountryFlagSrc,
  getCountryShortToken,
} from '../utils/country'

// Annex C allocation table: maps the set of 8 qualified third-place groups
// (key sorted A->L) to { roundOf32MatchNumber: groupLetter whose third plays }.
interface AllocationTable {
  combinations: Record<string, Record<string, string>>
}

// Round-of-32 third-place tokens (from calendar.json) -> their match number.
const THIRD_TOKEN_MATCH: Record<string, number> = {
  '3ABCDF': 74,
  '3CDFGH': 77,
  '3CEFHI': 79,
  '3EHIJK': 80,
  '3BEFIJ': 81,
  '3AEHIJ': 82,
  '3EFGIJ': 85,
  '3DEIJL': 87,
}

interface ResolvedTeam {
  team: string
  flagUrl?: string | null | undefined
}

// Background + text color per group (A-L) for the leading badge.
const GROUP_COLORS: Record<string, { bg: string; fg: string }> = {
  A: { bg: '#e6194b', fg: '#ffffff' },
  B: { bg: '#3cb44b', fg: '#0b0b0b' },
  C: { bg: '#ffd400', fg: '#0b0b0b' },
  D: { bg: '#4363d8', fg: '#ffffff' },
  E: { bg: '#f58231', fg: '#0b0b0b' },
  F: { bg: '#911eb4', fg: '#ffffff' },
  G: { bg: '#19c3e6', fg: '#0b0b0b' },
  H: { bg: '#f032e6', fg: '#ffffff' },
  I: { bg: '#a8d10a', fg: '#0b0b0b' },
  J: { bg: '#ff8fb3', fg: '#0b0b0b' },
  K: { bg: '#2aa198', fg: '#ffffff' },
  L: { bg: '#b5651d', fg: '#ffffff' },
}

// Feeder matches for each knockout match (winner-of / loser-of source numbers).
const KNOCKOUT_FEEDERS: Record<number, [string, string]> = {
  // Round of 16 — winners of the round of 32
  89: ['W74', 'W77'],
  90: ['W73', 'W75'],
  91: ['W76', 'W78'],
  92: ['W79', 'W80'],
  93: ['W83', 'W84'],
  94: ['W81', 'W82'],
  95: ['W86', 'W88'],
  96: ['W85', 'W87'],
  // Quarter-finals
  97: ['W89', 'W90'],
  98: ['W93', 'W94'],
  99: ['W91', 'W92'],
  100: ['W95', 'W96'],
  // Semi-finals
  101: ['W97', 'W98'],
  102: ['W99', 'W100'],
  // Third place (losers of the semi-finals)
  103: ['L101', 'L102'],
  // Final
  104: ['W101', 'W102'],
}

function splitIntoSizedColumns(matches: CalendarMatch[], sizes: number[]) {
  const columns: CalendarMatch[][] = []
  let startIndex = 0

  for (const size of sizes) {
    columns.push(matches.slice(startIndex, startIndex + size))
    startIndex += size
  }

  return columns
}

function getGroupLetter(group: string | undefined): string | null {
  if (!group) {
    return null
  }

  const match = group.match(/([A-L])\s*$/i)
  return match?.[1] ? match[1].toUpperCase() : null
}

function resolveSideToken(match: CalendarMatch, side: 'home' | 'away'): string {
  const raw = side === 'home' ? match.home : match.away

  const feeders = KNOCKOUT_FEEDERS[match.matchNumber]
  if (feeders) {
    return side === 'home' ? feeders[0] : feeders[1]
  }

  if (raw === 'To be announced') {
    return 'TBA'
  }

  return raw
}

function renderFlag(country: string) {
  const flagSrc = getCountryFlagSrc(country)
  if (flagSrc) {
    return (
      <img
        className="board-flag-image"
        src={flagSrc}
        alt=""
        aria-hidden="true"
      />
    )
  }

  return <span className="board-flag-token">{getCountryShortToken(country)}</span>
}

function renderLeadBadge(match: CalendarMatch) {
  if (match.phase === 'groups') {
    const letter = getGroupLetter(match.group)
    if (!letter) {
      return <span className="board-lead-badge" aria-hidden="true" />
    }

    const palette = GROUP_COLORS[letter] ?? { bg: '#353535', fg: '#ffffff' }
    return (
      <span
        className="board-lead-badge board-group-badge"
        style={{ background: palette.bg, color: palette.fg }}
      >
        {letter}
      </span>
    )
  }

  return <span className="board-lead-badge board-match-no">{match.matchNumber}</span>
}

function renderFixtureSide(
  match: CalendarMatch,
  side: 'home' | 'away',
  tokenResolution?: Map<string, ResolvedTeam>,
) {
  if (match.phase === 'groups') {
    const liveFlagUrl = side === 'home' ? match.liveHomeFlagUrl : match.liveAwayFlagUrl
    if (liveFlagUrl) {
      return <img className="board-flag-image" src={liveFlagUrl} alt="" aria-hidden="true" />
    }

    return renderFlag(side === 'home' ? match.home : match.away)
  }

  const token = resolveSideToken(match, side)
  const resolved = tokenResolution?.get(token)
  if (resolved) {
    if (resolved.flagUrl) {
      return <img className="board-flag-image" src={resolved.flagUrl} alt="" aria-hidden="true" />
    }
    return renderFlag(resolved.team)
  }

  return <span className="board-group-origin">{token}</span>
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

interface StandingRow {
  team: string
  group: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
}

function createRow(team: string, group: string): StandingRow {
  return {
    team,
    group,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  }
}

function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.team.localeCompare(b.team)
  })
}

interface HeadToHeadRow {
  points: number
  gd: number
  gf: number
}

// Mini-tabla considerando solo los partidos jugados entre el conjunto de
// equipos empatados. Si dos equipos no se han enfrentado, su aportacion
// head-to-head queda a cero (se considera empate y decide el criterio global).
function buildHeadToHead(teams: string[], matches: CalendarMatch[]): Map<string, HeadToHeadRow> {
  const set = new Set(teams)
  const mini = new Map<string, HeadToHeadRow>(
    teams.map((team) => [team, { points: 0, gd: 0, gf: 0 }]),
  )

  for (const match of matches) {
    if (match.phase !== 'groups') continue
    if (!set.has(match.home) || !set.has(match.away)) continue

    const hs = match.liveHomeScore
    const as = match.liveAwayScore
    if (hs == null || as == null) continue

    const home = mini.get(match.home)!
    const away = mini.get(match.away)!
    home.gf += hs
    away.gf += as
    home.gd += hs - as
    away.gd += as - hs

    if (hs > as) {
      home.points += 3
    } else if (hs < as) {
      away.points += 3
    } else {
      home.points += 1
      away.points += 1
    }
  }

  return mini
}

// Orden FIFA dentro de un grupo: puntos -> head-to-head (puntos, DG, goles
// entre los empatados) -> DG global -> goles global -> nombre.
function sortGroupStandings(rows: StandingRow[], matches: CalendarMatch[]): StandingRow[] {
  const byPoints = [...rows].sort((a, b) => b.points - a.points)
  const result: StandingRow[] = []

  let i = 0
  while (i < byPoints.length) {
    let j = i
    while (j < byPoints.length && byPoints[j]!.points === byPoints[i]!.points) j++
    const cluster = byPoints.slice(i, j)

    if (cluster.length > 1) {
      const h2h = buildHeadToHead(
        cluster.map((row) => row.team),
        matches,
      )
      cluster.sort((a, b) => {
        const ha = h2h.get(a.team)!
        const hb = h2h.get(b.team)!
        if (hb.points !== ha.points) return hb.points - ha.points
        if (hb.gd !== ha.gd) return hb.gd - ha.gd
        if (hb.gf !== ha.gf) return hb.gf - ha.gf
        if (b.gd !== a.gd) return b.gd - a.gd
        if (b.gf !== a.gf) return b.gf - a.gf
        return a.team.localeCompare(b.team)
      })
    }

    result.push(...cluster)
    i = j
  }

  return result
}

function computeGroupStandings(matches: CalendarMatch[]): Map<string, StandingRow[]> {
  const groups = new Map<string, Map<string, StandingRow>>()

  const ensureRow = (letter: string, team: string): StandingRow => {
    let table = groups.get(letter)
    if (!table) {
      table = new Map<string, StandingRow>()
      groups.set(letter, table)
    }
    let row = table.get(team)
    if (!row) {
      row = createRow(team, letter)
      table.set(team, row)
    }
    return row
  }

  for (const match of matches) {
    if (match.phase !== 'groups') continue
    const letter = getGroupLetter(match.group)
    if (!letter) continue

    const home = ensureRow(letter, match.home)
    const away = ensureRow(letter, match.away)

    const hs = match.liveHomeScore
    const as = match.liveAwayScore
    if (hs == null || as == null) continue

    home.played += 1
    away.played += 1
    home.gf += hs
    home.ga += as
    away.gf += as
    away.ga += hs
    home.gd = home.gf - home.ga
    away.gd = away.gf - away.ga

    if (hs > as) {
      home.won += 1
      away.lost += 1
      home.points += 3
    } else if (hs < as) {
      away.won += 1
      home.lost += 1
      away.points += 3
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }

  const result = new Map<string, StandingRow[]>()
  for (const [letter, table] of groups) {
    result.set(letter, sortGroupStandings([...table.values()], matches))
  }
  return result
}

// Map team name -> live flag URL (from finished/ongoing group matches).
function buildFlagMap(matches: CalendarMatch[]): Map<string, string> {
  const flags = new Map<string, string>()
  for (const match of matches) {
    if (match.phase !== 'groups') continue
    if (match.liveHomeFlagUrl) flags.set(match.home, match.liveHomeFlagUrl)
    if (match.liveAwayFlagUrl) flags.set(match.away, match.liveAwayFlagUrl)
  }
  return flags
}

// Given the current standings + Annex C table, work out which group's third
// plays in each of the 8 round-of-32 matches that include a third-placed team.
// Returns null until 8 thirds are known or the combination is missing.
function computeThirdAllocation(
  standings: Map<string, StandingRow[]>,
  allocation: AllocationTable | null,
): Map<number, string> | null {
  if (!allocation) return null

  const thirds: StandingRow[] = []
  for (const rows of standings.values()) {
    if (rows[2]) thirds.push(rows[2])
  }
  if (thirds.length < 8) return null

  const top8 = sortStandings(thirds).slice(0, 8)
  const key = top8
    .map((row) => row.group)
    .sort()
    .join('')

  const mapping = allocation.combinations[key]
  if (!mapping) return null

  const result = new Map<number, string>()
  for (const [matchNo, group] of Object.entries(mapping)) {
    result.set(Number(matchNo), group)
  }
  return result
}

// Build resolution for every group-derived token that appears in the bracket:
// "1X"/"2X" from standings positions, and the eight "3XXXXX" third tokens via
// the Annex C allocation. Returns a map token -> resolved team.
function buildTokenResolution(
  standings: Map<string, StandingRow[]>,
  thirdGroupByMatch: Map<number, string> | null,
  flagMap: Map<string, string>,
): Map<string, ResolvedTeam> {
  const resolution = new Map<string, ResolvedTeam>()

  for (const [letter, rows] of standings) {
    if (rows[0]) resolution.set(`1${letter}`, { team: rows[0].team, flagUrl: flagMap.get(rows[0].team) })
    if (rows[1]) resolution.set(`2${letter}`, { team: rows[1].team, flagUrl: flagMap.get(rows[1].team) })
  }

  if (thirdGroupByMatch) {
    for (const [token, matchNo] of Object.entries(THIRD_TOKEN_MATCH)) {
      const group = thirdGroupByMatch.get(matchNo)
      const row = group ? standings.get(group)?.[2] : undefined
      if (row) resolution.set(token, { team: row.team, flagUrl: flagMap.get(row.team) })
    }
  }

  return resolution
}

function renderTeamFlag(team: string, liveFlagUrl?: string | null) {
  if (liveFlagUrl) {
    return <img className="standings-flag-image" src={liveFlagUrl} alt="" aria-hidden="true" />
  }
  const flagSrc = getCountryFlagSrc(team)
  if (flagSrc) {
    return <img className="standings-flag-image" src={flagSrc} alt="" aria-hidden="true" />
  }
  return <span className="standings-flag-token">{getCountryShortToken(team)}</span>
}

function GroupStandingsGrid({ standings }: { standings: Map<string, StandingRow[]> }) {
  const letters = [...standings.keys()].sort()
  if (letters.length === 0) return null

  return (
    <div className="standings-grid">
      {letters.map((letter) => {
        const palette = GROUP_COLORS[letter] ?? { bg: '#353535', fg: '#ffffff' }
        const rows = standings.get(letter) ?? []
        return (
          <div key={letter} className="standings-card">
            <header className="standings-card-head">
              <span
                className="standings-badge"
                style={{ background: palette.bg, color: palette.fg }}
              >
                {letter}
              </span>
              <span className="standings-card-title">GROUP {letter}</span>
              <span className="standings-col-head">
                <span>PJ</span>
                <span>DG</span>
                <span>PT</span>
              </span>
            </header>
            <ol className="standings-rows">
              {rows.map((row, index) => (
                <li
                  key={row.team}
                  className={index < 2 ? 'standings-row standings-row-qual' : 'standings-row'}
                >
                  <span className="standings-pos">{index + 1}</span>
                  <span className="standings-flag" aria-hidden="true">
                    {renderTeamFlag(row.team)}
                  </span>
                  <span className="standings-name">{row.team}</span>
                  <span className="standings-stat">{row.played}</span>
                  <span className="standings-stat">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
                  <span className="standings-stat standings-pts">{row.points}</span>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

function ThirdPlaceTable({ standings }: { standings: Map<string, StandingRow[]> }) {
  const thirds: StandingRow[] = []
  for (const rows of standings.values()) {
    if (rows[2]) thirds.push(rows[2])
  }
  if (thirds.length === 0) return null

  const ranked = sortStandings(thirds)

  return (
    <div className="thirds-card">
      <header className="thirds-head">
        <span className="thirds-subtitle">Los 8 primeros clasifican a dieciseisavos</span>
      </header>
      <ol className="thirds-rows">
        {ranked.map((row, index) => {
          const palette = GROUP_COLORS[row.group] ?? { bg: '#353535', fg: '#ffffff' }
          return (
            <li
              key={row.team}
              className={index < 8 ? 'thirds-row thirds-row-qual' : 'thirds-row'}
            >
              <span className="thirds-pos">{index + 1}</span>
              <span
                className="standings-badge thirds-badge"
                style={{ background: palette.bg, color: palette.fg }}
              >
                {row.group}
              </span>
              <span className="standings-flag" aria-hidden="true">
                {renderTeamFlag(row.team)}
              </span>
              <span className="thirds-name">{row.team}</span>
              <span className="thirds-stat">{row.played}</span>
              <span className="thirds-stat">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
              <span className="thirds-stat thirds-pts">{row.points}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Knockout bracket
// ---------------------------------------------------------------------------

interface BracketColumn {
  title: string
  matches: CalendarMatch[]
}

function buildBracketColumns(matches: CalendarMatch[]): BracketColumn[] {
  const byPhase = (phase: CalendarMatch['phase']) =>
    matches
      .filter((match) => match.phase === phase)
      .sort((a, b) => a.matchNumber - b.matchNumber)

  const finals = matches
    .filter((match) => match.phase === 'final')
    .sort((a, b) => a.matchNumber - b.matchNumber)

  return [
    { title: 'Dieciseisavos', matches: byPhase('r32') },
    { title: 'Octavos', matches: byPhase('r16') },
    { title: 'Cuartos', matches: byPhase('quarter') },
    { title: 'Semifinales', matches: byPhase('semi') },
    { title: 'Final', matches: finals },
  ].filter((column) => column.matches.length > 0)
}

function bracketScore(match: CalendarMatch, side: 'home' | 'away'): string {
  const value = side === 'home' ? match.liveHomeScore : match.liveAwayScore
  return value != null ? String(value) : ''
}

function renderBracketToken(token: string, resolved?: ResolvedTeam) {
  if (!resolved) {
    return <span className="bracket-token">{token}</span>
  }

  const flagSrc = resolved.flagUrl ?? getCountryFlagSrc(resolved.team)
  return (
    <span className="bracket-token bracket-token-resolved">
      {flagSrc ? (
        <img className="bracket-flag-image" src={flagSrc} alt="" aria-hidden="true" />
      ) : null}
      <span className="bracket-token-name">{getCountryShortToken(resolved.team)}</span>
    </span>
  )
}

function KnockoutBracket({
  matches,
  timeZone,
  tokenResolution,
}: {
  matches: CalendarMatch[]
  timeZone: string
  tokenResolution: Map<string, ResolvedTeam>
}) {
  const columns = buildBracketColumns(matches)
  if (columns.length === 0) return null

  return (
    <div className="bracket">
      {columns.map((column) => (
        <div key={column.title} className="bracket-column">
          <span className="bracket-column-title">{column.title}</span>
          <div className="bracket-matches">
            {column.matches.map((match) => {
              const homeToken = resolveSideToken(match, 'home')
              const awayToken = resolveSideToken(match, 'away')
              return (
                <div key={match.id} className="bracket-match">
                  <div className="bracket-match-top">
                    <span className="bracket-match-no">{match.matchNumber}</span>
                    <div className="bracket-meta">
                      <span className="bracket-venue">{match.location}</span>
                      <span className="bracket-time">
                        {match.kickoffUtc ? formatKickoff(match.kickoffUtc, timeZone) : ''}
                      </span>
                    </div>
                  </div>
                  <div className="bracket-sides">
                    <div className="bracket-side">
                      {renderBracketToken(homeToken, tokenResolution.get(homeToken))}
                      <span className="bracket-score">{bracketScore(match, 'home')}</span>
                    </div>
                    <div className="bracket-side">
                      {renderBracketToken(awayToken, tokenResolution.get(awayToken))}
                      <span className="bracket-score">{bracketScore(match, 'away')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TournamentBoardPage() {
  const { matches, isLoading, error } = useCalendarData()
  const timeZone = useTimezone()
  const [allocation, setAllocation] = useState<AllocationTable | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('./data/third-place-allocation.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AllocationTable | null) => {
        if (!cancelled) setAllocation(data)
      })
      .catch(() => {
        if (!cancelled) setAllocation(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const mainColumns = useMemo(() => {
    const mainMatches = matches
      .filter((match) => match.phase !== 'final')
      .sort((left, right) => left.matchNumber - right.matchNumber)

    return splitIntoSizedColumns(mainMatches, [22, 22, 22, 18, 18])
  }, [matches])

  const standings = useMemo(() => computeGroupStandings(matches), [matches])

  const tokenResolution = useMemo(() => {
    const flagMap = buildFlagMap(matches)
    const thirdGroupByMatch = computeThirdAllocation(standings, allocation)
    return buildTokenResolution(standings, thirdGroupByMatch, flagMap)
  }, [matches, standings, allocation])

  if (isLoading) {
    return <section className="status-card">Cargando tablero...</section>
  }

  if (error) {
    return <section className="status-card error">No se pudo cargar el tablero: {error}</section>
  }

  return (
    <section className="board-page" aria-label="Tablero del Mundial 2026">
      <article className="board-frame">
        <header className="board-header">
          <h1>104 MATCHES</h1>
          <div className="board-brand" aria-hidden="true">
            <span className="board-brand-number">26</span>
            <span className="board-brand-copy">
              <span>FIFA WORLD CUP</span>
              <span>2026</span>
            </span>
          </div>
        </header>

        <div className="board-body">
          <div className="board-column board-column-left" aria-label="Partidos del tablero">
            <div className="board-main-grid">
              {mainColumns.map((column, columnIndex) => (
                <div key={columnIndex} className="board-main-column">
                  {column.map((match) => (
                    <div key={match.id} className="board-fixture">
                      {renderLeadBadge(match)}
                      <span className="board-flag" aria-hidden="true">
                        {renderFixtureSide(match, 'home', tokenResolution)}
                      </span>
                      <span className="board-match-result board-match-result-live">
                        {match.liveHomeScore != null || match.liveAwayScore != null
                          ? `${match.liveHomeScore ?? '—'}-${match.liveAwayScore ?? '—'}`
                          : 'v'}
                      </span>
                      <span className="board-flag" aria-hidden="true">
                        {renderFixtureSide(match, 'away', tokenResolution)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="board-special-row">
              <section className="board-final-card board-third-place">
                <span className="board-final-title">BRONZE FINAL</span>
                <span className="board-slot board-slot-wide">L101</span>
                <span className="board-versus">v</span>
                <span className="board-slot board-slot-wide">L102</span>
              </section>

              <section className="board-final-card board-final-match">
                <span className="board-final-title">FINAL</span>
                <span className="board-slot board-slot-wide">W101</span>
                <span className="board-versus">v</span>
                <span className="board-slot board-slot-wide">W102</span>
              </section>
            </div>
          </div>
        </div>
      </article>

      <section className="board-extras" aria-label="Clasificaciones y cuadro final">
        <h2 className="board-extras-title">Clasificación de grupos</h2>
        <GroupStandingsGrid standings={standings} />

        <h2 className="board-extras-title">Mejores terceros</h2>
        <ThirdPlaceTable standings={standings} />

        <h2 className="board-extras-title">Cuadro final</h2>
        <KnockoutBracket matches={matches} timeZone={timeZone} tokenResolution={tokenResolution} />
      </section>
    </section>
  )
}
