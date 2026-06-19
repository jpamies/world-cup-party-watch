import { useMemo } from 'react'
import { useCalendarData } from '../hooks/useCalendarData'
import type { CalendarMatch } from '../types/calendar'
import { getCountryFlagEmoji, getCountryShortToken } from '../utils/country'

const BRACKET_LABELS = [
  ['W1', 'W2'],
  ['W3', 'W4'],
  ['W5', 'W6'],
  ['W7', 'W8'],
  ['W9', 'W10'],
  ['W11', 'W12'],
  ['W13', 'W14'],
  ['W15', 'W16'],
  ['W17', 'W18'],
  ['W19', 'W20'],
  ['W21', 'W22'],
  ['W23', 'W24'],
  ['W25', 'W26'],
  ['W27', 'W28'],
  ['W29', 'W30'],
  ['W31', 'W32'],
  ['W33', 'W34'],
  ['W35', 'W36'],
] as const

function chunkMatches(matches: CalendarMatch[]) {
  const rows: CalendarMatch[][] = []

  for (let index = 0; index < matches.length; index += 4) {
    rows.push(matches.slice(index, index + 4))
  }

  return rows
}

function renderFlag(country: string) {
  return getCountryFlagEmoji(country) ?? getCountryShortToken(country)
}

export default function TournamentBoardPage() {
  const { matches, isLoading, error } = useCalendarData()

  const rows = useMemo(() => {
    const groupMatches = matches.filter((match) => match.phase === 'groups')
    return chunkMatches(groupMatches)
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

        <div className="board-grid">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="board-row">
              {row.map((match) => (
                <div key={match.id} className="board-fixture">
                  <span className="board-flag" aria-hidden="true">
                    {renderFlag(match.home)}
                  </span>
                  <span className="board-versus">v</span>
                  <span className="board-flag" aria-hidden="true">
                    {renderFlag(match.away)}
                  </span>
                </div>
              ))}

              {BRACKET_LABELS[rowIndex]?.map((label) => (
                <span key={label} className="board-slot">
                  {label}
                </span>
              ))}
            </div>
          ))}

          <div className="board-special-row">
            <section className="board-final-card board-third-place">
              <span className="board-final-title">BRONZE FINAL</span>
              <span className="board-slot board-slot-wide">RU01</span>
              <span className="board-versus">v</span>
              <span className="board-slot board-slot-wide">RU02</span>
            </section>

            <section className="board-final-card board-final-match">
              <span className="board-final-title">FINAL</span>
              <span className="board-slot board-slot-empty" aria-hidden="true" />
              <span className="board-versus">v</span>
              <span className="board-slot board-slot-empty" aria-hidden="true" />
            </section>
          </div>
        </div>
      </article>
    </section>
  )
}
