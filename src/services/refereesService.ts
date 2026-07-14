import type { CalendarMatch, MatchOfficial } from '../types/calendar'

export interface RefereeRoleCount {
  roleType: number
  role: string
  count: number
}

export interface RefereeRankingRow {
  officialId: string
  name: string
  countryCode: string
  flagUrl: string | null
  total: number
  roles: RefereeRoleCount[]
  cards: number
  penalties: number
}

// FIFA official type → etiqueta corta en español. Fallback: el rol localizado.
const ROLE_LABELS_ES: Record<number, string> = {
  1: 'Árbitro',
  2: 'Asistente',
  3: 'Asistente',
  4: '4º árbitro',
  5: 'VAR',
  6: 'AVAR',
}

export function localizeRole(roleType: number, fallback: string): string {
  return ROLE_LABELS_ES[roleType] ?? fallback
}

// Bandera del país del árbitro por código FIFA de 3 letras (BRA, PAR, ...).
export function refereeFlagUrl(countryCode: string): string | null {
  if (!countryCode) {
    return null
  }
  return `https://api.fifa.com/api/v3/picture/flags-sq-4/${countryCode}`
}

/**
 * Agrega los oficiales de todos los partidos en una clasificación por número
 * de partidos arbitrados, con desglose por rol. Ordena por total desc, luego
 * por partidos como árbitro principal, y finalmente por nombre.
 */
export function rankReferees(matches: CalendarMatch[]): RefereeRankingRow[] {
  const byOfficial = new Map<
    string,
    {
      name: string
      countryCode: string
      total: number
      roles: Map<number, RefereeRoleCount>
      cards: number
      penalties: number
    }
  >()

  for (const match of matches) {
    const officials: MatchOfficial[] = match.liveOfficials ?? []
    for (const official of officials) {
      if (!official.officialId) continue

      let entry = byOfficial.get(official.officialId)
      if (!entry) {
        entry = {
          name: official.name,
          countryCode: official.countryCode,
          total: 0,
          roles: new Map(),
          cards: 0,
          penalties: 0,
        }
        byOfficial.set(official.officialId, entry)
      }

      entry.total += 1
      // Keep the most complete name/country seen for this official.
      if (official.name) entry.name = official.name
      if (official.countryCode) entry.countryCode = official.countryCode

      // Cards and penalties count only for the match's main referee (type 1).
      if (official.roleType === 1) {
        entry.cards += match.liveCards ?? 0
        entry.penalties += match.livePenalties ?? 0
      }

      const role = entry.roles.get(official.roleType)
      if (role) {
        role.count += 1
      } else {
        entry.roles.set(official.roleType, {
          roleType: official.roleType,
          role: localizeRole(official.roleType, official.role),
          count: 1,
        })
      }
    }
  }

  const refereeCount = (roles: RefereeRoleCount[]) =>
    roles.find((r) => r.roleType === 1)?.count ?? 0

  return [...byOfficial.entries()]
    .map(([officialId, entry]) => ({
      officialId,
      name: entry.name,
      countryCode: entry.countryCode,
      flagUrl: refereeFlagUrl(entry.countryCode),
      total: entry.total,
      roles: [...entry.roles.values()].sort((a, b) => a.roleType - b.roleType),
      cards: entry.cards,
      penalties: entry.penalties,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        refereeCount(b.roles) - refereeCount(a.roles) ||
        a.name.localeCompare(b.name),
    )
}
