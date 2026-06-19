import { useMemo } from 'react'
import { useCalendarData } from '../hooks/useCalendarData'
import type { CalendarMatch } from '../types/calendar'
import {
  getCountryFlagSrc,
  getCountryShortToken,
} from '../utils/country'

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

function renderFixtureSide(match: CalendarMatch, side: 'home' | 'away') {
  if (match.phase === 'groups') {
    const liveFlagUrl = side === 'home' ? match.liveHomeFlagUrl : match.liveAwayFlagUrl
    if (liveFlagUrl) {
      return <img className="board-flag-image" src={liveFlagUrl} alt="" aria-hidden="true" />
    }

    return renderFlag(side === 'home' ? match.home : match.away)
  }

  return <span className="board-group-origin">{resolveSideToken(match, side)}</span>
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
    result.set(letter, sortStandings([...table.values()]))
  }
  return result
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

function KnockoutBracket({ matches }: { matches: CalendarMatch[] }) {
  const columns = buildBracketColumns(matches)
  if (columns.length === 0) return null

  return (
    <div className="bracket">
      {columns.map((column) => (
        <div key={column.title} className="bracket-column">
          <span className="bracket-column-title">{column.title}</span>
          <div className="bracket-matches">
            {column.matches.map((match) => (
              <div key={match.id} className="bracket-match">
                <span className="bracket-match-no">{match.matchNumber}</span>
                <div className="bracket-sides">
                  <div className="bracket-side">
                    <span className="bracket-token">{resolveSideToken(match, 'home')}</span>
                    <span className="bracket-score">{bracketScore(match, 'home')}</span>
                  </div>
                  <div className="bracket-side">
                    <span className="bracket-token">{resolveSideToken(match, 'away')}</span>
                    <span className="bracket-score">{bracketScore(match, 'away')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TournamentBoardPage() {
  const { matches, isLoading, error } = useCalendarData()

  const mainColumns = useMemo(() => {
    const mainMatches = matches
      .filter((match) => match.phase !== 'final')
      .sort((left, right) => left.matchNumber - right.matchNumber)

    return splitIntoSizedColumns(mainMatches, [22, 22, 22, 18, 18])
  }, [matches])

  const standings = useMemo(() => computeGroupStandings(matches), [matches])

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
                        {renderFixtureSide(match, 'home')}
                      </span>
                      <span className="board-match-result board-match-result-live">
                        {match.liveHomeScore != null || match.liveAwayScore != null
                          ? `${match.liveHomeScore ?? '—'}-${match.liveAwayScore ?? '—'}`
                          : 'v'}
                      </span>
                      <span className="board-flag" aria-hidden="true">
                        {renderFixtureSide(match, 'away')}
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
        <KnockoutBracket matches={matches} />
      </section>
    </section>
  )
}
