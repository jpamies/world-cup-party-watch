import { useMemo, useState, type ReactNode } from 'react'
import type { CalendarMatch } from '../types/calendar'
import { rankReferees, type RefereeRankingRow } from '../services/refereesService'

interface RefereeRankingProps {
  matches: CalendarMatch[]
}

function roleCount(row: RefereeRankingRow, roleTypes: number[]): number {
  return row.roles.reduce(
    (sum, role) => (roleTypes.includes(role.roleType) ? sum + role.count : sum),
    0,
  )
}

// Icono compacto para la cabecera (amarilla, roja, penalti, VAR).
function StatIcon({ kind }: { kind: 'yellow' | 'red' | 'penalty' | 'var' }) {
  if (kind === 'penalty') {
    return <span className="referee-icon referee-icon-pen" aria-hidden="true" />
  }
  if (kind === 'var') {
    return <span className="referee-icon referee-icon-var" aria-hidden="true" />
  }
  return (
    <span
      className={`referee-icon referee-icon-card referee-icon-${kind}`}
      aria-hidden="true"
    />
  )
}

// Media por partido (solo partidos como árbitro principal). Usada para ordenar.
function perMatch(total: number, refereeMatches: number): number {
  return refereeMatches > 0 ? total / refereeMatches : 0
}

// Celda "media por partido (total)". La media usa solo partidos como
// árbitro principal (refereeMatches). Sin datos → punto.
function avgWithTotal(total: number, refereeMatches: number): ReactNode {
  if (total <= 0) {
    return <span className="referee-role-empty">·</span>
  }
  const avg = refereeMatches > 0 ? (total / refereeMatches).toFixed(1) : '—'
  return (
    <>
      {avg}
      <span className="referee-role-avg"> ({total})</span>
    </>
  )
}

function plainCount(value: number): ReactNode {
  return value > 0 ? value : <span className="referee-role-empty">·</span>
}

const STAT_COLUMNS: {
  key: string
  label: string
  icon?: 'yellow' | 'red' | 'penalty' | 'var'
  value: (row: RefereeRankingRow) => number
  render: (row: RefereeRankingRow) => ReactNode
}[] = [
  {
    key: 'arbitro',
    label: 'Árbitro',
    value: (row) => roleCount(row, [1]),
    render: (row) => plainCount(roleCount(row, [1])),
  },
  {
    key: 'cuarto',
    label: '4º árbitro',
    value: (row) => roleCount(row, [4]),
    render: (row) => plainCount(roleCount(row, [4])),
  },
  {
    key: 'fouls',
    label: 'Faltas',
    value: (row) => perMatch(row.fouls, row.refereeMatches),
    render: (row) => avgWithTotal(row.fouls, row.refereeMatches),
  },
  {
    key: 'yellow',
    label: 'Amarillas',
    icon: 'yellow',
    value: (row) => perMatch(row.yellowCards, row.refereeMatches),
    render: (row) => avgWithTotal(row.yellowCards, row.refereeMatches),
  },
  {
    key: 'red',
    label: 'Rojas',
    icon: 'red',
    value: (row) => perMatch(row.redCards, row.refereeMatches),
    render: (row) => avgWithTotal(row.redCards, row.refereeMatches),
  },
  {
    key: 'penalties',
    label: 'Penales',
    icon: 'penalty',
    value: (row) => perMatch(row.penalties, row.refereeMatches),
    render: (row) => avgWithTotal(row.penalties, row.refereeMatches),
  },
  {
    key: 'var',
    label: 'VAR',
    icon: 'var',
    value: (row) => perMatch(row.varReviews, row.refereeMatches),
    render: (row) => avgWithTotal(row.varReviews, row.refereeMatches),
  },
]


type SortKey = 'name' | 'total' | string
type SortDir = 'asc' | 'desc'

export function RefereeRanking({ matches }: RefereeRankingProps) {
  const rows = useMemo(() => rankReferees(matches), [matches])
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedRows = useMemo(() => {
    const statCol = STAT_COLUMNS.find((col) => col.key === sortKey)
    const factor = sortDir === 'asc' ? 1 : -1
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortKey === 'total') {
        cmp = a.total - b.total
      } else if (statCol) {
        cmp = statCol.value(a) - statCol.value(b)
      }
      if (cmp === 0) cmp = b.total - a.total
      if (cmp === 0) cmp = a.name.localeCompare(b.name)
      return cmp * factor
    })
    return copy
  }, [rows, sortKey, sortDir])

  if (rows.length === 0) {
    return (
      <p className="referee-empty">
        Aún no hay partidos con equipo arbitral asignado.
      </p>
    )
  }

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return ''
    return sortDir === 'asc' ? ' \u25b2' : ' \u25bc'
  }

  const headerClass = (key: SortKey, base: string) =>
    `${base} referee-th-sortable${key === sortKey ? ' referee-th-active' : ''}`

  return (
    <div className="referee-table-wrap">
      <table className="referee-table">
        <thead>
          <tr>
            <th className="referee-col-rank">#</th>
            <th
              className={headerClass('name', 'referee-col-name')}
              onClick={() => handleSort('name')}
            >
              Árbitro{sortIndicator('name')}
            </th>
            <th
              className={headerClass('total', 'referee-col-total')}
              onClick={() => handleSort('total')}
            >
              Partidos{sortIndicator('total')}
            </th>
            {STAT_COLUMNS.map((col) => (
              <th
                key={col.key}
                className={headerClass(col.key, 'referee-col-role')}
                onClick={() => handleSort(col.key)}
              >
                {col.icon ? <StatIcon kind={col.icon} /> : null}
                {col.label}
                {sortIndicator(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => {
            return (
              <tr key={row.officialId}>
                <td className="referee-col-rank">{index + 1}</td>
                <td className="referee-col-name">
                  <span className="referee-identity">
                    {row.flagUrl ? (
                      <img
                        className="referee-flag"
                        src={row.flagUrl}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="referee-name">{row.name}</span>
                    {row.countryCode ? (
                      <span className="referee-country">{row.countryCode}</span>
                    ) : null}
                  </span>
                </td>
                <td className="referee-col-total">{row.total}</td>
                {STAT_COLUMNS.map((col) => (
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
  )
}
