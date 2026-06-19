import type { CSSProperties } from 'react'
import type { CalendarMatch, ChannelId } from '../types/calendar'
import { getCountryFlagSrc, getCountryShortToken } from '../utils/country'
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
  onTeamClick?: (team: string) => void
  onGroupClick?: (groupLetter: string) => void
  onChannelClick?: (channel: ChannelId) => void
}

function getGroupLetter(group: string | undefined): string {
  if (!group) {
    return 'X'
  }

  const normalized = group.trim().toUpperCase()
  const letter = normalized.match(/[A-Z]$/)?.[0]
  return letter ?? 'X'
}

function renderFlag(country: string, liveFlagUrl?: string | null) {
  const flagSrc = liveFlagUrl ?? getCountryFlagSrc(country)
  if (flagSrc) {
    return <img className="pixel-flag-image" src={flagSrc} alt="" aria-hidden="true" />
  }

  return <span className="pixel-flag-token">{getCountryShortToken(country)}</span>
}

const GROUP_STYLE_MAP: Record<string, CSSProperties> = {
  A: { background: '#00d44a30', borderColor: '#00d44a', color: '#6dff9e' },
  B: { background: '#0066ff33', borderColor: '#3b82ff', color: '#9ec2ff' },
  C: { background: '#ff2d5530', borderColor: '#ff2d55', color: '#ff8ea2' },
  D: { background: '#ffcc0030', borderColor: '#ffcc00', color: '#ffe78c' },
  E: { background: '#00d0d830', borderColor: '#00d0d8', color: '#8cfdff' },
  F: { background: '#b26dff30', borderColor: '#b26dff', color: '#d9b8ff' },
  G: { background: '#ff8a0030', borderColor: '#ff8a00', color: '#ffc38c' },
  H: { background: '#ff4ddb30', borderColor: '#ff4ddb', color: '#ffb3ef' },
  I: { background: '#a8e60030', borderColor: '#a8e600', color: '#ddff84' },
  J: { background: '#4da6ff30', borderColor: '#4da6ff', color: '#b5ddff' },
  K: { background: '#ffd16630', borderColor: '#ffd166', color: '#ffe7ad' },
  L: { background: '#9b5de530', borderColor: '#9b5de5', color: '#d6bcff' },
  X: { background: '#80808030', borderColor: '#9a9a9a', color: '#e0e0e0' },
}

export function MatchCard({
  match,
  timezone,
  isFavorite,
  onToggleFavorite,
  onTeamClick,
  onGroupClick,
  onChannelClick,
}: MatchCardProps) {
  const kickoff = formatKickoff(match.kickoffUtc, timezone)
  const isWeekendSlot = isWeekendWatchWindow(match.kickoffUtc, timezone)
  const groupLetter = getGroupLetter(match.group)
  const groupStyle = GROUP_STYLE_MAP[groupLetter] ?? GROUP_STYLE_MAP.X
  const hasLiveScore = match.liveHomeScore != null || match.liveAwayScore != null

  return (
    <article className={isWeekendSlot ? 'match-card weekend-match' : 'match-card'}>
      <div className="match-card-topline">
        <div className="chip-row">
          <span className="chip chip-group" style={groupStyle}>
            <button
              type="button"
              className="chip-button"
              onClick={() => onGroupClick?.(groupLetter)}
              title={`Filtrar por Grupo ${groupLetter}`}
            >
              {groupLetter}
            </button>
          </span>
          <button
            type="button"
            className="group-label-button"
            onClick={() => onGroupClick?.(groupLetter)}
            title={`Filtrar por Grupo ${groupLetter}`}
          >
            Grupo {groupLetter}
          </button>
          {isWeekendSlot ? <span className="weekend-badge">FINDE</span> : null}
        </div>
        <button
          type="button"
          className={isFavorite ? 'star-button is-active' : 'star-button'}
          onClick={() => onToggleFavorite(match.id)}
          aria-label={
            isFavorite ? 'Quitar de favoritos' : 'Anadir este partido a favoritos'
          }
          title={isFavorite ? 'Quitar favorito' : 'Anadir favorito'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      <div className="match-main-row">
        <h3 className="match-teams">
          <button
            type="button"
            className="team-filter-button"
            onClick={() => onTeamClick?.(match.home)}
            title={`Filtrar por ${match.home}`}
          >
            <span className="team-with-flag">
              {renderFlag(match.home, match.liveHomeFlagUrl)}
              <span>{match.home}</span>
            </span>
          </button>
          <span className="versus-dot">-</span>
          <button
            type="button"
            className="team-filter-button"
            onClick={() => onTeamClick?.(match.away)}
            title={`Filtrar por ${match.away}`}
          >
            <span className="team-with-flag">
              {renderFlag(match.away, match.liveAwayFlagUrl)}
              <span>{match.away}</span>
            </span>
          </button>
        </h3>
        <p className="match-meta">{kickoff}</p>
        <p className="match-meta match-location">{match.location}</p>
        <div className="channel-row" aria-label="Canales de emision">
          {match.channels.map((channel) => (
            <button
              key={channel}
              type="button"
              className={`channel-pill channel-${channel}`}
              onClick={() => onChannelClick?.(channel)}
              title={`Filtrar por ${CHANNEL_LABELS[channel]}`}
            >
              {CHANNEL_LABELS[channel]}
            </button>
          ))}
        </div>
        {hasLiveScore ? (
          <div className="match-live-row" aria-label="Marcador en directo">
            <span className="match-live-score">
              {match.liveHomeScore ?? '—'} - {match.liveAwayScore ?? '—'}
            </span>
            {match.liveStatusLabel ? (
              <span className="match-live-status">{match.liveStatusLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="match-secondary-row">
        <span className="match-meta">{match.matchdayName}</span>
        <span className="match-meta">#{match.matchNumber}</span>
      </div>
    </article>
  )
}
