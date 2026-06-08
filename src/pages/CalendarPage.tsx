import { useMemo, useState } from 'react'
import { FiltersBar } from '../components/FiltersBar'
import { MatchCard } from '../components/MatchCard'
import { useCalendarData } from '../hooks/useCalendarData'
import { useFavorites } from '../hooks/useFavorites'
import { useTimezone } from '../hooks/useTimezone'
import type { CalendarMatch, MatchPhase } from '../types/calendar'
import { getLocalDayKey, getLocalHour, isUpcomingMatch } from '../utils/date'

function groupMatchesByDay(matches: CalendarMatch[], timezone: string) {
  const grouped = new Map<string, CalendarMatch[]>()

  for (const match of matches) {
    const key = getLocalDayKey(match.kickoffUtc, timezone)
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(match)
      continue
    }

    grouped.set(key, [match])
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
}

export default function CalendarPage() {
  const timezone = useTimezone()
  const { matches, isLoading, error } = useCalendarData()
  const { favoriteIds, favoriteCount, toggleFavorite } = useFavorites()
  const [query, setQuery] = useState('')
  const [selectedPhase, setSelectedPhase] = useState<MatchPhase | 'all'>('all')
  const [selectedHour, setSelectedHour] = useState('all')
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(true)

  const hourOptions = useMemo(() => {
    const uniqueHours = new Set(
      matches.map((match) => `${String(getLocalHour(match.kickoffUtc, timezone)).padStart(2, '0')}:00`),
    )
    return [...uniqueHours].sort((left, right) => left.localeCompare(right))
  }, [matches, timezone])

  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return matches.filter((match) => {
      const inPhase = selectedPhase === 'all' || match.phase === selectedPhase
      const inText =
        normalizedQuery.length === 0 ||
        [match.home, match.away, match.location, match.group]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery))
      const inUpcomingWindow = !showUpcomingOnly || isUpcomingMatch(match.kickoffUtc)
      const localHour = getLocalHour(match.kickoffUtc, timezone)
      const hourLabel = `${String(localHour).padStart(2, '0')}:00`
      const inHourSelection = selectedHour === 'all' || hourLabel === selectedHour

      return inPhase && inText && inUpcomingWindow && inHourSelection
    })
  }, [matches, query, selectedPhase, showUpcomingOnly, selectedHour, timezone])

  const grouped = useMemo(
    () => groupMatchesByDay(filteredMatches, timezone),
    [filteredMatches, timezone],
  )

  if (isLoading) {
    return <section className="status-card">Loading matches...</section>
  }

  if (error) {
    return <section className="status-card error">Failed to load data: {error}</section>
  }

  return (
    <section className="page-stack">
      <p className="page-hint">Local timezone: {timezone}</p>
      <p className="page-hint">Favorites selected: {favoriteCount}</p>

      <FiltersBar
        query={query}
        onQueryChange={setQuery}
        selectedPhase={selectedPhase}
        onPhaseChange={setSelectedPhase}
        selectedHour={selectedHour}
        hourOptions={hourOptions}
        onHourChange={setSelectedHour}
        showUpcomingOnly={showUpcomingOnly}
        onShowUpcomingOnlyChange={setShowUpcomingOnly}
      />

      {grouped.length === 0 ? (
        <section className="status-card">No matches found with the active filters.</section>
      ) : (
        grouped.map(([day, dayMatches]) => (
          <section key={day} className="day-block">
            <h2>{day}</h2>
            <div className="match-grid">
              {dayMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  timezone={timezone}
                  isFavorite={favoriteIds.has(match.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  )
}
