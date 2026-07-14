import { useMemo, useState } from 'react'
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

const STAT_COLUMNS: {
  key: string
  label: string
  value: (row: RefereeRankingRow) => number
}[] = [
  { key: 'arbitro', label: 'Árbitro', value: (row) => roleCount(row, [1]) },
  { key: 'cuarto', label: '4º árbitro', value: (row) => roleCount(row, [4]) },
  { key: 'cards', label: 'Tarjetas', value: (row) => row.cards },
  { key: 'penalties', label: 'Penales', value: (row) => row.penalties },
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
                {STAT_COLUMNS.map((col) => {
                  const value = col.value(row)
                  return (
                    <td key={col.key} className="referee-col-role">
                      {value > 0 ? (
                        value
                      ) : (
                        <span className="referee-role-empty">·</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
