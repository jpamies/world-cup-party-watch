import type { MatchPhase } from '../types/calendar'

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
}

const PHASE_OPTIONS: Array<{ label: string; value: MatchPhase | 'all' }> = [
  { label: 'All phases', value: 'all' },
  { label: 'Group Stage', value: 'groups' },
  { label: 'Round of 32', value: 'r32' },
  { label: 'Round of 16', value: 'r16' },
  { label: 'Quarter Finals', value: 'quarter' },
  { label: 'Semi Finals', value: 'semi' },
  { label: 'Final', value: 'final' },
]

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
}: FiltersBarProps) {
  return (
    <section className="filters-panel" aria-label="Filters">
      <label className="input-wrap">
        Search team or venue
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="e.g. Spain, Mexico, Boston"
        />
      </label>

      <label className="input-wrap">
        Tournament phase
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
        Local hour
        <select value={selectedHour} onChange={(event) => onHourChange(event.target.value)}>
          <option value="all">Any</option>
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
        Upcoming only
      </label>
    </section>
  )
}
