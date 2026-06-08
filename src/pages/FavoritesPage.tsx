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
  const [selectionName, setSelectionName] = useState('Peña Mundialera')
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
      setSaveFeedback('Pon un nombre antes de guardar.')
      return
    }

    const firstAttempt = saveSelection(normalizedName)
    if (firstAttempt.status === 'requires-confirmation') {
      const shouldOverwrite = window.confirm(
        `Ya existe una seleccion llamada "${normalizedName}". Quieres sobrescribirla?`,
      )

      if (!shouldOverwrite) {
        setSaveFeedback('Guardado cancelado. Se mantiene la seleccion existente.')
        return
      }

      const overwriteResult = saveSelection(normalizedName, {
        overwriteByName: true,
      })
      if (overwriteResult.selection) {
        setSelectionName(overwriteResult.selection.name)
        setSelectedSavedId(overwriteResult.selection.id)
      }
      setSaveFeedback('Seleccion sobrescrita correctamente.')
      return
    }

    if (firstAttempt.selection) {
      setSelectionName(firstAttempt.selection.name)
      setSelectedSavedId(firstAttempt.selection.id)
    }

    if (firstAttempt.status === 'saved') {
      setSaveFeedback('Seleccion guardada en local.')
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
    setSaveFeedback(`Seleccion cargada: ${loaded.name}`)
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
    return <section className="status-card">Cargando favoritos...</section>
  }

  if (error) {
    return <section className="status-card error">No se pudieron cargar los datos: {error}</section>
  }

  return (
    <section className="page-stack">
      <p className="page-hint">Zona horaria local: {timezone}</p>
      <p className="page-hint">Partidos favoritos guardados: {favoriteList.length}</p>

      {pendingSharedSelection ? (
        <section className="status-card">
          Seleccion compartida encontrada: <strong>{pendingSharedSelection.name}</strong> ({' '}
          {pendingSharedSelection.favorites.length} partidos)
          <div className="actions-row">
            <button type="button" className="mini-button" onClick={handleApplySharedSelection}>
              Cargar seleccion compartida
            </button>
            <button type="button" className="mini-button" onClick={handleDismissSharedSelection}>
              Ignorar
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
          Nombre de la seleccion
          <input
            type="text"
            value={selectionName}
            onChange={(event) => setSelectionName(event.target.value)}
            placeholder="p. ej. Viernes de mundial"
          />
        </label>
        <div className="actions-row">
          <button type="button" className="mini-button" onClick={handleDownloadCalendarInvite}>
            Descargar invitacion .ics
          </button>
          <button type="button" className="mini-button" onClick={handleCreateShareLink}>
            Crear enlace para compartir
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={handleSaveSelection}
          >
            Guardar seleccion en local
          </button>
        </div>

        {saveFeedback ? <p className="save-feedback">{saveFeedback}</p> : null}

        {shareLink ? (
          <label className="input-wrap">
            URL para compartir
            <input type="text" readOnly value={shareLink} />
          </label>
        ) : null}

        <div className="actions-row">
          <select
            value={selectedSavedId}
            onChange={(event) => setSelectedSavedId(event.target.value)}
            className="saved-select"
          >
            <option value="">Cargar seleccion guardada...</option>
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
            Cargar
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={() => selectedSavedId && deleteSelection(selectedSavedId)}
            disabled={!selectedSavedId}
          >
            Borrar
          </button>
        </div>
      </section>

      {favoriteMatches.length === 0 ? (
        <section className="status-card">
          Aun no tienes favoritos. Anade estrellas en Todos los partidos y apareceran aqui.
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
