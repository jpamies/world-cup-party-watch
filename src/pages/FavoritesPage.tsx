import { useMemo, useState } from 'react'
import { FiltersBar } from '../components/FiltersBar'
import { MatchCard } from '../components/MatchCard'
import { useCalendarData } from '../hooks/useCalendarData'
import { useFavorites } from '../hooks/useFavorites'
import { useTimezone } from '../hooks/useTimezone'
import type { MatchPhase } from '../types/calendar'
import { getLocalHour, isUpcomingMatch } from '../utils/date'

export default function FavoritesPage() {
  const timezone = useTimezone()
  const { matches, isLoading, error } = useCalendarData()
  const { favoriteIds, favoriteList, toggleFavorite } = useFavorites()
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

  const favoriteMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return matches.filter((match) => {
      if (!favoriteIds.has(match.id)) {
        return false
      }

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
  }, [
    matches,
    favoriteIds,
    query,
    selectedPhase,
    showUpcomingOnly,
    selectedHour,
    timezone,
  ])

  if (isLoading) {
    return <section className="status-card">Loading favorites...</section>
  }

  if (error) {
    return <section className="status-card error">Failed to load data: {error}</section>
  }

  return (
    <section className="page-stack">
      <p className="page-hint">Local timezone: {timezone}</p>
      <p className="page-hint">Stored favorite matches: {favoriteList.length}</p>

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

      {favoriteMatches.length === 0 ? (
        <section className="status-card">
          No favorite matches yet. Add stars in All Matches and they appear here.
        </section>
      ) : (
        <div className="match-grid">
          {favoriteMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              timezone={timezone}
              isFavorite={favoriteIds.has(match.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}
    </section>
  )
}
