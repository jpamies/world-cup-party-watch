import { useMemo, useState } from 'react'
import { FiltersBar } from '../components/FiltersBar'
import { MatchCard } from '../components/MatchCard'
import { useCalendarData } from '../hooks/useCalendarData'
import { useFavorites } from '../hooks/useFavorites'
import { useTimezone } from '../hooks/useTimezone'
import type { CalendarMatch } from '../types/calendar'
import { getLocalDayKey, getLocalHour } from '../utils/date'
import {
  createDefaultMatchFilterState,
  matchPassesFilters,
  type MatchFilterState,
} from '../utils/matchFilters'

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
  const [filters, setFilters] = useState<MatchFilterState>(
    createDefaultMatchFilterState,
  )

  const hourOptions = useMemo(() => {
    const uniqueHours = new Set(
      matches.map((match) => `${String(getLocalHour(match.kickoffUtc, timezone)).padStart(2, '0')}:00`),
    )
    return [...uniqueHours].sort((left, right) => left.localeCompare(right))
  }, [matches, timezone])

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => matchPassesFilters(match, timezone, filters))
  }, [matches, filters, timezone])

  const clearQuickFilters = () => {
    setFilters((prev) => ({
      ...prev,
      selectedTeam: 'all',
      selectedGroup: 'all',
      selectedChannel: 'all',
    }))
  }

  const grouped = useMemo(
    () => groupMatchesByDay(filteredMatches, timezone),
    [filteredMatches, timezone],
  )

  if (isLoading) {
    return <section className="status-card">Cargando partidos...</section>
  }

  if (error) {
    return <section className="status-card error">No se pudieron cargar los datos: {error}</section>
  }

  return (
    <section className="page-stack">
      <p className="page-hint">Zona horaria local: {timezone}</p>
      <p className="page-hint">Favoritos seleccionados: {favoriteCount}</p>

      <FiltersBar
        query={filters.query}
        onQueryChange={(query) => setFilters((prev) => ({ ...prev, query }))}
        selectedPhase={filters.selectedPhase}
        onPhaseChange={(selectedPhase) =>
          setFilters((prev) => ({ ...prev, selectedPhase }))
        }
        selectedHour={filters.selectedHour}
        hourOptions={hourOptions}
        onHourChange={(selectedHour) =>
          setFilters((prev) => ({ ...prev, selectedHour }))
        }
        showUpcomingOnly={filters.showUpcomingOnly}
        onShowUpcomingOnlyChange={(showUpcomingOnly) =>
          setFilters((prev) => ({ ...prev, showUpcomingOnly }))
        }
        selectedTeam={filters.selectedTeam}
        selectedGroup={filters.selectedGroup}
        selectedChannel={filters.selectedChannel}
        onClearQuickFilters={clearQuickFilters}
      />

      {grouped.length === 0 ? (
        <section className="status-card">No hay partidos con los filtros activos.</section>
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
                  onTeamClick={(team) =>
                    setFilters((prev) => ({ ...prev, selectedTeam: team }))
                  }
                  onGroupClick={(group) =>
                    setFilters((prev) => ({ ...prev, selectedGroup: group }))
                  }
                  onChannelClick={(channel) =>
                    setFilters((prev) => ({ ...prev, selectedChannel: channel }))
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  )
}
