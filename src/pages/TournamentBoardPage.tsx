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
  return match ? match[1].toUpperCase() : null
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

export default function TournamentBoardPage() {
  const { matches, isLoading, error } = useCalendarData()

  const mainColumns = useMemo(() => {
    const mainMatches = matches
      .filter((match) => match.phase !== 'final')
      .sort((left, right) => left.matchNumber - right.matchNumber)

    return splitIntoSizedColumns(mainMatches, [22, 22, 22, 18, 18])
  }, [matches])

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
    </section>
  )
}
