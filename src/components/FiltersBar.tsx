import type { ChannelId, MatchPhase } from '../types/calendar'

interface FiltersBarProps {
  query: string
  onQueryChange: (value: string) => void
  selectedPhase: MatchPhase | 'all'
  onPhaseChange: (phase: MatchPhase | 'all') => void
  selectedHour: string
  hourOptions: string[]
  onHourChange: (value: string) => void
  showUpcomingOnly: boolean
  onShowUpcomingOnlyChange: (checked: boolean) => void
  selectedTeam: string
  selectedGroup: string
  selectedChannel: ChannelId | 'all'
  onClearQuickFilters: () => void
}

const PHASE_OPTIONS: Array<{ label: string; value: MatchPhase | 'all' }> = [
  { label: 'Todas las fases', value: 'all' },
  { label: 'Fase de grupos', value: 'groups' },
  { label: 'Dieciseisavos', value: 'r32' },
  { label: 'Octavos', value: 'r16' },
  { label: 'Cuartos', value: 'quarter' },
  { label: 'Semifinales', value: 'semi' },
  { label: 'Final', value: 'final' },
]

const CHANNEL_LABELS: Record<ChannelId, string> = {
  dazn: 'DAZN',
  la1: 'La 1 TVE',
  'rtve-play': 'RTVE Play',
}

export function FiltersBar({
  query,
  onQueryChange,
  selectedPhase,
  onPhaseChange,
  selectedHour,
  hourOptions,
  onHourChange,
  showUpcomingOnly,
  onShowUpcomingOnlyChange,
  selectedTeam,
  selectedGroup,
  selectedChannel,
  onClearQuickFilters,
}: FiltersBarProps) {
  const hasQuickFilters =
    selectedTeam !== 'all' ||
    selectedGroup !== 'all' ||
    selectedChannel !== 'all'

  return (
    <section className="filters-panel" aria-label="Filtros">
      <label className="input-wrap">
        Buscar equipo o estadio
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="p. ej. Espana, Mexico, Boston"
        />
      </label>

      <label className="input-wrap">
        Fase del torneo
        <select
          value={selectedPhase}
          onChange={(event) =>
            onPhaseChange(event.target.value as MatchPhase | 'all')
          }
        >
          {PHASE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="input-wrap">
        Hora local
        <select value={selectedHour} onChange={(event) => onHourChange(event.target.value)}>
          <option value="all">Cualquiera</option>
          {hourOptions.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox-wrap">
        <input
          type="checkbox"
          checked={showUpcomingOnly}
          onChange={(event) => onShowUpcomingOnlyChange(event.target.checked)}
        />
        Solo proximos
      </label>

      {hasQuickFilters ? (
        <div className="quick-filters" role="status" aria-live="polite">
          {selectedTeam !== 'all' ? (
            <span className="quick-filter-chip">Equipo: {selectedTeam}</span>
          ) : null}
          {selectedGroup !== 'all' ? (
            <span className="quick-filter-chip">Grupo: {selectedGroup}</span>
          ) : null}
          {selectedChannel !== 'all' ? (
            <span className="quick-filter-chip">
              Canal: {CHANNEL_LABELS[selectedChannel]}
            </span>
          ) : null}
          <button type="button" className="mini-button" onClick={onClearQuickFilters}>
            Limpiar filtros rapidos
          </button>
        </div>
      ) : null}
    </section>
  )
}
