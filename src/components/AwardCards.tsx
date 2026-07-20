import { useEffect, useState, type ReactNode } from 'react'
import {
  loadPlayers,
  playerFlagUrl,
  positionLabel,
  type PlayerStatRow,
} from '../services/playersService'

interface AwardStat {
  label: string
  value: (row: PlayerStatRow) => ReactNode
}

interface AwardDef {
  key: string
  emoji: string
  title: string
  subtitle: string
  // Ganador (decisión editorial, por idPlayer del snapshot).
  playerId: string
  stats: AwardStat[]
}

// Ganadores del Mundial 2026. Bota y Guante salen de los datos; Balón de Oro
// y Mejor joven son galardones (no derivables de las estadísticas).
const AWARDS: AwardDef[] = [
  {
    key: 'ball',
    emoji: '🏆',
    title: 'Balón de Oro',
    subtitle: 'Mejor jugador',
    playerId: '411375', // Rodri (ESP)
    stats: [{ label: 'Partidos', value: (r) => r.matches }],
  },
  {
    key: 'young',
    emoji: '🌟',
    title: 'Mejor joven',
    subtitle: 'Jugador sub-21',
    playerId: '474973', // Pau Cubarsí (ESP)
    stats: [{ label: 'Partidos', value: (r) => r.matches }],
  },
  {
    key: 'glove',
    emoji: '🧤',
    title: 'Guante de Oro',
    subtitle: 'Mejor portero',
    playerId: '430753', // Unai Simón (ESP)
    stats: [
      { label: 'Portería 0', value: (r) => r.cleanSheets },
      { label: 'Encajados', value: (r) => r.conceded },
    ],
  },
  {
    key: 'boot',
    emoji: '🥇',
    title: 'Bota de Oro',
    subtitle: 'Máximo goleador',
    playerId: '389867', // Kylian Mbappé (FRA)
    stats: [
      { label: 'Goles', value: (r) => r.goals },
      { label: 'Asist.', value: (r) => r.assists },
    ],
  },
]

export function AwardCards() {
  const [byId, setById] = useState<Map<string, PlayerStatRow>>(new Map())

  useEffect(() => {
    let alive = true
    loadPlayers().then((list) => {
      if (alive) setById(new Map(list.map((p) => [String(p.idPlayer), p])))
    })
    return () => {
      alive = false
    }
  }, [])

  const cards = AWARDS.map((award) => ({ award, player: byId.get(award.playerId) })).filter(
    (c) => c.player,
  )

  if (cards.length === 0) {
    return null
  }

  return (
    <div className="award-cards">
      {cards.map(({ award, player }) => {
        const row = player as PlayerStatRow
        const flag = playerFlagUrl(row.teamAbbr)
        return (
          <article key={award.key} className={`award-card award-card-${award.key}`}>
            <div className="award-card-head">
              <span className="award-card-emoji" aria-hidden="true">
                {award.emoji}
              </span>
              <span className="award-card-titles">
                <span className="award-card-title">{award.title}</span>
                <span className="award-card-subtitle">{award.subtitle}</span>
              </span>
            </div>
            <div className="award-card-player">
              {row.photo ? (
                <img
                  className="award-card-photo"
                  src={row.photo}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                />
              ) : (
                <span className="award-card-photo award-card-photo-empty" aria-hidden="true" />
              )}
              <span className="award-card-name">{row.name}</span>
              <span className="award-card-meta">
                {flag ? (
                  <img
                    className="referee-flag"
                    src={flag}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                  />
                ) : null}
                <span className="referee-country">{row.teamAbbr}</span>
                {positionLabel(row.position) ? (
                  <span className="player-position">{positionLabel(row.position)}</span>
                ) : null}
              </span>
            </div>
            <div className="award-card-stats">
              {award.stats.map((stat) => (
                <span key={stat.label} className="award-card-stat">
                  <span className="award-card-stat-value">{stat.value(row)}</span>
                  <span className="award-card-stat-label">{stat.label}</span>
                </span>
              ))}
            </div>
          </article>
        )
      })}
    </div>
  )
}
