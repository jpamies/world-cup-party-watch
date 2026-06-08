import type { CalendarMatch } from '../types/calendar'
import { formatKickoff } from '../utils/date'

interface MatchCardProps {
  match: CalendarMatch
  timezone: string
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
}

export function MatchCard({
  match,
  timezone,
  isFavorite,
  onToggleFavorite,
}: MatchCardProps) {
  return (
    <article className="match-card">
      <div className="match-card-topline">
        <span className="chip">{match.group ?? match.phase.toUpperCase()}</span>
        <button
          type="button"
          className={isFavorite ? 'star-button is-active' : 'star-button'}
          onClick={() => onToggleFavorite(match.id)}
          aria-label={
            isFavorite ? 'Remove from favorites' : 'Add this match to favorites'
          }
          title={isFavorite ? 'Remove favorite' : 'Add favorite'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      <h3 className="match-teams">
        {match.home} vs {match.away}
      </h3>

      <p className="match-meta">{formatKickoff(match.kickoffUtc, timezone)}</p>
      <p className="match-meta">{match.location}</p>
    </article>
  )
}
