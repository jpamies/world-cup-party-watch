import type { CalendarMatch } from '../types/calendar'
import { formatKickoff, isWeekendWatchWindow } from '../utils/date'

const CHANNEL_LABELS: Record<string, string> = {
  dazn: 'DAZN',
  la1: 'La 1 TVE',
  'rtve-play': 'RTVE Play',
}

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
  const kickoff = formatKickoff(match.kickoffUtc, timezone)
  const isWeekendSlot = isWeekendWatchWindow(match.kickoffUtc, timezone)

  return (
    <article className={isWeekendSlot ? 'match-card weekend-match' : 'match-card'}>
      <div className="match-card-topline">
        <div className="chip-row">
          <span className="chip">{match.group ?? match.phase.toUpperCase()}</span>
          {isWeekendSlot ? <span className="weekend-badge">WEEKEND</span> : null}
        </div>
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

      <div className="match-main-row">
        <h3 className="match-teams">
          {match.home} vs {match.away}
        </h3>
        <p className="match-meta">{kickoff}</p>
        <p className="match-meta match-location">{match.location}</p>
        <div className="channel-row" aria-label="Broadcast channels">
          {match.channels.map((channel) => (
            <span key={channel} className={`channel-pill channel-${channel}`}>
              {CHANNEL_LABELS[channel]}
            </span>
          ))}
        </div>
      </div>
      <div className="match-secondary-row">
        <span className="match-meta">{match.matchdayName}</span>
        <span className="match-meta">#{match.matchNumber}</span>
      </div>
    </article>
  )
}
