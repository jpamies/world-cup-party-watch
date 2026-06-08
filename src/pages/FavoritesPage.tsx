import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiltersBar } from '../components/FiltersBar'
import { MatchCard } from '../components/MatchCard'
import { useCalendarData } from '../hooks/useCalendarData'
import { useFavorites } from '../hooks/useFavorites'
import { useTimezone } from '../hooks/useTimezone'
import { getLocalHour } from '../utils/date'
import {
  buildFavoritesCalendarInvite,
  downloadInviteFile,
} from '../utils/calendarInvite'
import {
  createDefaultMatchFilterState,
  matchPassesFilters,
  type MatchFilterState,
} from '../utils/matchFilters'
import { decodeSelection, encodeSelection } from '../utils/shareSelection'

export default function FavoritesPage() {
  const timezone = useTimezone()
  const { matches, isLoading, error } = useCalendarData()
  const {
    favoriteIds,
    favoriteList,
    savedSelections,
    toggleFavorite,
    replaceFavorites,
    saveSelection,
    loadSelection,
    deleteSelection,
  } = useFavorites()
  const [filters, setFilters] = useState<MatchFilterState>(
    createDefaultMatchFilterState,
  )
  const [selectionName, setSelectionName] = useState('Party Watch Crew')
  const [shareLink, setShareLink] = useState('')
  const [selectedSavedId, setSelectedSavedId] = useState('')
  const [saveFeedback, setSaveFeedback] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const pendingSharedSelection = useMemo(() => {
    const encoded = searchParams.get('share')
    if (!encoded) {
      return null
    }

    const decoded = decodeSelection(encoded)
    if (!decoded) {
      return null
    }

    return {
      name: decoded.name,
      favorites: decoded.favorites,
    }
  }, [searchParams])

  const hourOptions = useMemo(() => {
    const uniqueHours = new Set(
      matches.map((match) => `${String(getLocalHour(match.kickoffUtc, timezone)).padStart(2, '0')}:00`),
    )
    return [...uniqueHours].sort((left, right) => left.localeCompare(right))
  }, [matches, timezone])

  const favoriteMatches = useMemo(() => {
    return matches.filter((match) => {
      if (!favoriteIds.has(match.id)) {
        return false
      }

      return matchPassesFilters(match, timezone, filters)
    })
  }, [matches, favoriteIds, filters, timezone])

  const clearQuickFilters = () => {
    setFilters((prev) => ({
      ...prev,
      selectedTeam: 'all',
      selectedGroup: 'all',
      selectedChannel: 'all',
    }))
  }

  const handleDownloadCalendarInvite = () => {
    if (favoriteMatches.length === 0) {
      return
    }

    const fileSafeName = selectionName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const fileName = `${fileSafeName || 'favorites'}-world-cup-2026.ics`
    const invite = buildFavoritesCalendarInvite(favoriteMatches, selectionName)
    downloadInviteFile(fileName, invite)
  }

  const handleSaveSelection = () => {
    const normalizedName = selectionName.trim()
    if (!normalizedName) {
      setSaveFeedback('Please set a name before saving.')
      return
    }

    const firstAttempt = saveSelection(normalizedName)
    if (firstAttempt.status === 'requires-confirmation') {
      const shouldOverwrite = window.confirm(
        `A selection named "${normalizedName}" already exists. Overwrite it?`,
      )

      if (!shouldOverwrite) {
        setSaveFeedback('Save cancelled. Existing selection kept.')
        return
      }

      const overwriteResult = saveSelection(normalizedName, {
        overwriteByName: true,
      })
      if (overwriteResult.selection) {
        setSelectionName(overwriteResult.selection.name)
        setSelectedSavedId(overwriteResult.selection.id)
      }
      setSaveFeedback('Selection overwritten successfully.')
      return
    }

    if (firstAttempt.selection) {
      setSelectionName(firstAttempt.selection.name)
      setSelectedSavedId(firstAttempt.selection.id)
    }

    if (firstAttempt.status === 'saved') {
      setSaveFeedback('Selection saved locally.')
    }
  }

  const handleLoadSavedSelection = () => {
    if (!selectedSavedId) {
      return
    }

    const loaded = loadSelection(selectedSavedId)
    if (!loaded) {
      return
    }

    setSelectionName(loaded.name)
    setSaveFeedback(`Loaded selection: ${loaded.name}`)
  }

  const handleCreateShareLink = () => {
    if (favoriteList.length === 0) {
      return
    }

    const encoded = encodeSelection({
      name: selectionName,
      favorites: favoriteList,
    })

    const shareUrl = `${window.location.origin}${window.location.pathname}#/favorites?share=${encoded}`
    setShareLink(shareUrl)

    navigator.clipboard.writeText(shareUrl).catch(() => {
      // Clipboard may be unavailable in some browsers or privacy modes.
    })
  }

  const handleApplySharedSelection = () => {
    if (!pendingSharedSelection) {
      return
    }

    replaceFavorites(pendingSharedSelection.favorites)
    setSelectionName(pendingSharedSelection.name)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('share')
    setSearchParams(nextParams, { replace: true })
  }

  const handleDismissSharedSelection = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('share')
    setSearchParams(nextParams, { replace: true })
  }

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

      {pendingSharedSelection ? (
        <section className="status-card">
          Shared selection found: <strong>{pendingSharedSelection.name}</strong> ({' '}
          {pendingSharedSelection.favorites.length} matches)
          <div className="actions-row">
            <button type="button" className="mini-button" onClick={handleApplySharedSelection}>
              Load shared selection
            </button>
            <button type="button" className="mini-button" onClick={handleDismissSharedSelection}>
              Ignore
            </button>
          </div>
        </section>
      ) : null}

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

      <section className="favorites-tools">
        <label className="input-wrap">
          Selection name
          <input
            type="text"
            value={selectionName}
            onChange={(event) => setSelectionName(event.target.value)}
            placeholder="e.g. Friday party"
          />
        </label>
        <div className="actions-row">
          <button type="button" className="mini-button" onClick={handleDownloadCalendarInvite}>
            Download .ics invite
          </button>
          <button type="button" className="mini-button" onClick={handleCreateShareLink}>
            Create share link
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={handleSaveSelection}
          >
            Save selection locally
          </button>
        </div>

        {saveFeedback ? <p className="save-feedback">{saveFeedback}</p> : null}

        {shareLink ? (
          <label className="input-wrap">
            Share URL
            <input type="text" readOnly value={shareLink} />
          </label>
        ) : null}

        <div className="actions-row">
          <select
            value={selectedSavedId}
            onChange={(event) => setSelectedSavedId(event.target.value)}
            className="saved-select"
          >
            <option value="">Load saved selection...</option>
            {savedSelections.map((selection) => (
              <option key={selection.id} value={selection.id}>
                {selection.name} ({selection.favorites.length})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mini-button"
            onClick={handleLoadSavedSelection}
            disabled={!selectedSavedId}
          >
            Load
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={() => selectedSavedId && deleteSelection(selectedSavedId)}
            disabled={!selectedSavedId}
          >
            Delete
          </button>
        </div>
      </section>

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
      )}
    </section>
  )
}
