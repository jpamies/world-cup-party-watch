import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  loadPlayers,
  playerFlagUrl,
  playerPhotoUrl,
  positionLabel,
  type PlayerStatRow,
} from '../services/playersService'

type TabKey = 'boot' | 'glove'
type SortDir = 'asc' | 'desc'

interface StatColumn {
  key: string
  label: string
  value: (row: PlayerStatRow) => number
  render: (row: PlayerStatRow) => ReactNode
  // Dirección por defecto al activar el orden por esta columna.
  defaultDir: SortDir
}

function count(value: number): ReactNode {
  return value > 0 ? value : <span className="referee-role-empty">·</span>
}

const BOOT_COLUMNS: StatColumn[] = [
  {
    key: 'matches',
    label: 'PJ',
    value: (row) => row.matches,
    render: (row) => count(row.matches),
    defaultDir: 'desc',
  },
  {
    key: 'goals',
    label: 'Goles',
    value: (row) => row.goals,
    render: (row) => count(row.goals),
    defaultDir: 'desc',
  },
  {
    key: 'assists',
    label: 'Asist.',
    value: (row) => row.assists,
    render: (row) => count(row.assists),
    defaultDir: 'desc',
  },
]

const GLOVE_COLUMNS: StatColumn[] = [
  {
    key: 'gkMatches',
    label: 'PJ',
    value: (row) => row.gkMatches,
    render: (row) => count(row.gkMatches),
    defaultDir: 'desc',
  },
  {
    key: 'conceded',
    label: 'Encajados',
    value: (row) => row.conceded,
    render: (row) => count(row.conceded),
    defaultDir: 'asc',
  },
  {
    key: 'cleanSheets',
    label: 'Portería 0',
    value: (row) => row.cleanSheets,
    render: (row) => count(row.cleanSheets),
    defaultDir: 'desc',
  },
  {
    key: 'saves',
    label: 'Paradas',
    value: (row) => row.saves,
    render: (row) => count(row.saves),
    defaultDir: 'desc',
  },
]

// Orden por defecto (clave + dirección) por pestaña.
const TAB_DEFAULT_SORT: Record<TabKey, { key: string; dir: SortDir }> = {
  boot: { key: 'goals', dir: 'desc' },
  glove: { key: 'conceded', dir: 'asc' },
}

// Cadena de desempates por pestaña (se aplica tras el orden activo).
const TIE_CHAINS: Record<TabKey, { key: string; dir: SortDir }[]> = {
  boot: [
    { key: 'goals', dir: 'desc' },
    { key: 'assists', dir: 'desc' },
  ],
  glove: [
    { key: 'conceded', dir: 'asc' },
    { key: 'cleanSheets', dir: 'desc' },
    { key: 'saves', dir: 'desc' },
  ],
}

// Mínimo de partidos como portero para aparecer en el Guante de Oro.
const GLOVE_MIN_MATCHES = 4

// Máximo de filas por página.
const PAGE_SIZE = 20

export function PlayerRanking() {
  const [players, setPlayers] = useState<PlayerStatRow[]>([])
  const [tab, setTab] = useState<TabKey>('boot')
  const [sortKey, setSortKey] = useState<string>(TAB_DEFAULT_SORT.boot.key)
  const [sortDir, setSortDir] = useState<SortDir>(TAB_DEFAULT_SORT.boot.dir)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let alive = true
    loadPlayers().then((list) => {
      if (alive) setPlayers(list)
    })
    return () => {
      alive = false
    }
  }, [])

  const columns = tab === 'boot' ? BOOT_COLUMNS : GLOVE_COLUMNS

  const rows = useMemo(() => {
    if (tab === 'boot') {
      return players.filter((p) => p.goals > 0 || p.assists > 0)
    }
    return players.filter((p) => p.gkMatches >= GLOVE_MIN_MATCHES)
  }, [players, tab])

  const sortedRows = useMemo(() => {
    const colByKey = new Map(columns.map((col) => [col.key, col]))
    const factor = sortDir === 'asc' ? 1 : -1
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else {
        const col = colByKey.get(sortKey)
        if (col) cmp = col.value(a) - col.value(b)
      }
      cmp *= factor
      if (cmp !== 0) return cmp
      for (const tie of TIE_CHAINS[tab]) {
        if (tie.key === sortKey) continue
        const col = colByKey.get(tie.key)
        if (!col) continue
        const d = (col.value(a) - col.value(b)) * (tie.dir === 'asc' ? 1 : -1)
        if (d !== 0) return d
      }
      return a.name.localeCompare(b.name)
    })
    return copy
  }, [rows, columns, sortKey, sortDir, tab])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = sortedRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const handleTab = (next: TabKey) => {
    if (next === tab) return
    setTab(next)
    setSortKey(TAB_DEFAULT_SORT[next].key)
    setSortDir(TAB_DEFAULT_SORT[next].dir)
    setPage(0)
  }

  const handleSort = (col: StatColumn | 'name') => {
    setPage(0)
    if (col === 'name') {
      if (sortKey === 'name') {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey('name')
        setSortDir('asc')
      }
      return
    }
    if (col.key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col.key)
      setSortDir(col.defaultDir)
    }
  }

  const sortIndicator = (key: string) => {
    if (key !== sortKey) return ''
    return sortDir === 'asc' ? ' \u25b2' : ' \u25bc'
  }

  const headerClass = (key: string, base: string) =>
    `${base} referee-th-sortable${key === sortKey ? ' referee-th-active' : ''}`

  return (
    <div className={`player-ranking player-ranking-${tab}`}>
      <div className="player-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'boot'}
          className={`player-tab${tab === 'boot' ? ' player-tab-active' : ''}`}
          onClick={() => handleTab('boot')}
        >
          🥇 Bota de Oro
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'glove'}
          className={`player-tab${tab === 'glove' ? ' player-tab-active' : ''}`}
          onClick={() => handleTab('glove')}
        >
          🧤 Guante de Oro
        </button>
      </div>

      {sortedRows.length === 0 ? (
        <p className="referee-empty">Aún no hay datos de jugadores.</p>
      ) : (
        <div className="referee-table-wrap">
          <table className="referee-table">
            <thead>
              <tr>
                <th className="referee-col-rank">#</th>
                <th
                  className={headerClass('name', 'referee-col-name')}
                  onClick={() => handleSort('name')}
                >
                  Jugador{sortIndicator('name')}
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={headerClass(col.key, 'referee-col-role')}
                    onClick={() => handleSort(col)}
                  >
                    {col.label}
                    {sortIndicator(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const flag = playerFlagUrl(row.teamAbbr)
                return (
                  <tr key={row.idPlayer}>
                    <td className="referee-col-rank">{safePage * PAGE_SIZE + index + 1}</td>
                    <td className="referee-col-name">
                      <span className="player-identity">
                        {row.photo ? (
                          <img
                            className="player-photo"
                            src={playerPhotoUrl(row.photo) ?? undefined}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                          />
                        ) : (
                          <span className="player-photo player-photo-empty" aria-hidden="true" />
                        )}
                        <span className="player-name-block">
                          <span className="referee-name">{row.name}</span>
                          <span className="player-meta">
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
                              <span className="player-position">
                                {positionLabel(row.position)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </span>
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="referee-col-role">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {pageCount > 1 ? (
            <div className="player-pagination">
              <button
                type="button"
                className="player-page-btn"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ‹ Anterior
              </button>
              <span className="player-page-info">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="player-page-btn"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Siguiente ›
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
