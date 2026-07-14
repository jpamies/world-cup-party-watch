import { useMemo } from 'react'
import type { CalendarMatch } from '../types/calendar'
import { rankReferees } from '../services/refereesService'

interface RefereeRankingProps {
  matches: CalendarMatch[]
}

const ROLE_COLUMNS: { key: string; label: string; roleTypes: number[] }[] = [
  { key: 'arbitro', label: 'Árbitro', roleTypes: [1] },
  { key: 'cuarto', label: '4º árbitro', roleTypes: [4] },
  { key: 'asistente', label: 'Asistente', roleTypes: [2, 3] },
  { key: 'var', label: 'VAR', roleTypes: [5] },
  { key: 'avar', label: 'AVAR', roleTypes: [6] },
]

export function RefereeRanking({ matches }: RefereeRankingProps) {
  const rows = useMemo(() => rankReferees(matches), [matches])

  if (rows.length === 0) {
    return (
      <p className="referee-empty">
        Aún no hay partidos con equipo arbitral asignado.
      </p>
    )
  }

  return (
    <div className="referee-table-wrap">
      <table className="referee-table">
        <thead>
          <tr>
            <th className="referee-col-rank">#</th>
            <th className="referee-col-name">Árbitro</th>
            <th className="referee-col-total">Partidos</th>
            {ROLE_COLUMNS.map((col) => (
              <th key={col.key} className="referee-col-role">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const countByType = new Map<number, number>()
            for (const role of row.roles) {
              countByType.set(role.roleType, role.count)
            }
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
                {ROLE_COLUMNS.map((col) => {
                  const count = col.roleTypes.reduce(
                    (sum, type) => sum + (countByType.get(type) ?? 0),
                    0,
                  )
                  return (
                    <td key={col.key} className="referee-col-role">
                      {count > 0 ? (
                        count
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
