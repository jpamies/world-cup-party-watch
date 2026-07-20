const PLAYERS_URL = `${import.meta.env.BASE_URL}data/players-snapshot.json`

export interface PlayerStatRow {
  idPlayer: string
  name: string
  teamAbbr: string
  position: number
  photo: string | null
  matches: number
  goals: number
  assists: number
  saves: number
  gkMatches: number
  conceded: number
  cleanSheets: number
}

interface PlayersSnapshot {
  fetchedAt: string
  Players: PlayerStatRow[]
}

// FIFA position → etiqueta corta en español (0=POR, 1=DEF, 2=MED, 3=DEL).
const POSITION_LABELS_ES: Record<number, string> = {
  0: 'POR',
  1: 'DEF',
  2: 'MED',
  3: 'DEL',
}

export function positionLabel(position: number): string {
  return POSITION_LABELS_ES[position] ?? ''
}

// Bandera del país por código FIFA de 3 letras (FRA, ARG, ...). Local en public/flags/fifa.
export function playerFlagUrl(teamAbbr: string): string | null {
  if (!teamAbbr) {
    return null
  }
  return `${import.meta.env.BASE_URL}flags/fifa/${teamAbbr}.png`
}

// Resuelve la foto del jugador: rutas locales (img/players/..) llevan BASE_URL;
// las urls absolutas (legacy) se devuelven tal cual.
export function playerPhotoUrl(photo: string | null): string | null {
  if (!photo) {
    return null
  }
  if (/^https?:/i.test(photo)) {
    return photo
  }
  return `${import.meta.env.BASE_URL}${photo}`
}

let cache: Promise<PlayerStatRow[]> | null = null

export function loadPlayers(): Promise<PlayerStatRow[]> {
  if (!cache) {
    cache = fetch(PLAYERS_URL, { credentials: 'omit', cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`players-snapshot ${response.status}`)
        }
        return response.json() as Promise<PlayersSnapshot>
      })
      .then((snapshot) => snapshot.Players ?? [])
      .catch(() => [])
  }
  return cache
}
