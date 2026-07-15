import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  loadPlayers,
  playerFlagUrl,
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
    key: 'cleanSheets',
    label: 'Portería 0',
    value: (row) => row.cleanSheets,
    render: (row) => count(row.cleanSheets),
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
    key: 'saves',
    label: 'Paradas',
    value: (row) => row.saves,
    render: (row) => count(row.saves),
    defaultDir: 'desc',
  },
]

// Orden por defecto y desempates por pestaña.
const TAB_DEFAULT_SORT: Record<TabKey, string> = {
  boot: 'goals',
  glove: 'cleanSheets',
}

export function PlayerRanking() {
  const [players, setPlayers] = useState<PlayerStatRow[]>([])
  const [tab, setTab] = useState<TabKey>('boot')
  const [sortKey, setSortKey] = useState<string>(TAB_DEFAULT_SORT.boot)
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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
    return players.filter((p) => p.gkMatches > 0)
  }, [players, tab])

  const sortedRows = useMemo(() => {
    const statCol = columns.find((col) => col.key === sortKey)
    const factor = sortDir === 'asc' ? 1 : -1
    const tieCol =
      tab === 'boot'
        ? BOOT_COLUMNS.find((c) => c.key === 'assists')
        : GLOVE_COLUMNS.find((c) => c.key === 'conceded')
    const tieFactor = tab === 'boot' ? -1 : 1 // asist. desc, encajados asc
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (statCol) {
        cmp = statCol.value(a) - statCol.value(b)
      }
      cmp *= factor
      if (cmp === 0 && tieCol) cmp = (tieCol.value(a) - tieCol.value(b)) * tieFactor
      if (cmp === 0) cmp = a.name.localeCompare(b.name)
      return cmp
    })
    return copy
  }, [rows, columns, sortKey, sortDir, tab])

  const handleTab = (next: TabKey) => {
    if (next === tab) return
    setTab(next)
    setSortKey(TAB_DEFAULT_SORT[next])
    setSortDir('desc')
  }

  const handleSort = (col: StatColumn | 'name') => {
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
    <div className="player-ranking">
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
              {sortedRows.map((row, index) => {
                const flag = playerFlagUrl(row.teamAbbr)
                return (
                  <tr key={row.idPlayer}>
                    <td className="referee-col-rank">{index + 1}</td>
                    <td className="referee-col-name">
                      <span className="player-identity">
                        {row.photo ? (
                          <img
                            className="player-photo"
                            src={row.photo}
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
        </div>
      )}
    </div>
  )
}
