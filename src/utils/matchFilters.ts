import type { CalendarMatch, ChannelId, MatchPhase } from '../types/calendar'
import { getLocalHour, isUpcomingMatch } from './date'

export interface MatchFilterState {
  query: string
  selectedPhase: MatchPhase | 'all'
  selectedHour: string
  showUpcomingOnly: boolean
  selectedTeam: string
  selectedGroup: string
  selectedChannel: ChannelId | 'all'
}

export function createDefaultMatchFilterState(): MatchFilterState {
  return {
    query: '',
    selectedPhase: 'all',
    selectedHour: 'all',
    showUpcomingOnly: true,
    selectedTeam: 'all',
    selectedGroup: 'all',
    selectedChannel: 'all',
  }
}

export function matchPassesFilters(
  match: CalendarMatch,
  timezone: string,
  filters: MatchFilterState,
): boolean {
  const normalizedQuery = filters.query.trim().toLowerCase()
  const inPhase =
    filters.selectedPhase === 'all' || match.phase === filters.selectedPhase
  const inText =
    normalizedQuery.length === 0 ||
    [match.home, match.away, match.location, match.group]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery))

  const inUpcomingWindow =
    !filters.showUpcomingOnly || isUpcomingMatch(match.kickoffUtc)

  const localHour = getLocalHour(match.kickoffUtc, timezone)
  const hourLabel = `${String(localHour).padStart(2, '0')}:00`
  const inHourSelection =
    filters.selectedHour === 'all' || hourLabel === filters.selectedHour

  const inTeamSelection =
    filters.selectedTeam === 'all' ||
    match.home === filters.selectedTeam ||
    match.away === filters.selectedTeam

  const groupLetter = (match.group ?? '').trim().toUpperCase().slice(-1)
  const inGroupSelection =
    filters.selectedGroup === 'all' || groupLetter === filters.selectedGroup

  const inChannelSelection =
    filters.selectedChannel === 'all' ||
    match.channels.includes(filters.selectedChannel)

  return (
    inPhase &&
    inText &&
    inUpcomingWindow &&
    inHourSelection &&
    inTeamSelection &&
    inGroupSelection &&
    inChannelSelection
  )
}
