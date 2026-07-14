import { useMemo } from 'react'
import type { CalendarMatch } from '../types/calendar'
import { rankReferees } from '../services/refereesService'

interface RefereeRankingProps {
  matches: CalendarMatch[]
}

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
            <th className="referee-col-roles">Roles</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
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
              <td className="referee-col-roles">
                <span className="referee-role-badges">
                  {row.roles.map((role) => (
                    <span key={role.roleType} className="referee-role-badge">
                      {role.role}
                      <span className="referee-role-count">{role.count}</span>
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
