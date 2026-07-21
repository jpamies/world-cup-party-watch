// Carga public/academy/data/champions.json y calcula los récords históricos
// del "Hall of Fame" del Mundial: jugadores con más títulos, clubes que más
// campeones han aportado y canteras que más campeones han formado.

const CHAMPIONS_URL = `${import.meta.env.BASE_URL}academy/data/champions.json`

export interface AcademyYouth {
  club: string
  years: string | null
}

export interface AcademyPlayer {
  no: number | null
  pos: string | null
  name: string
  wiki: string | null
  dob: string | null
  caps: number | null
  goals: number | null
  club: string | null
  youth?: AcademyYouth[]
}

export interface AcademyEdition {
  year: number
  host: string
  champion: string
  iso2: string
  runnerUp: string
  score: string
  coach: string | null
  squad: AcademyPlayer[]
}

interface ChampionsData {
  generatedAt: string
  source: string
  editions: AcademyEdition[]
  clubCountries?: Record<string, string>
}

export interface PlayerTitles {
  name: string
  iso2: string
  titles: number
  years: number[]
}

export interface ClubCount {
  name: string
  count: number
  iso2?: string
}

export interface HallOfFame {
  players: PlayerTitles[]
  clubs: ClubCount[]
  academies: ClubCount[]
}

let cache: Promise<HallOfFame> | null = null

export function loadHallOfFame(): Promise<HallOfFame> {
  if (!cache) {
    cache = fetch(CHAMPIONS_URL, { credentials: 'omit', cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`champions ${response.status}`)
        }
        return response.json() as Promise<ChampionsData>
      })
      .then((data) => computeHallOfFame(data.editions ?? [], data.clubCountries ?? {}))
      .catch(() => ({ players: [], clubs: [], academies: [] }))
  }
  return cache
}

// Jugadores que aparecen en más plantillas campeonas (una entrada por edición).
function computePlayers(editions: AcademyEdition[]): PlayerTitles[] {
  const byPlayer = new Map<string, PlayerTitles>()
  for (const edition of editions) {
    for (const player of edition.squad) {
      const key = player.wiki ?? player.name
      let entry = byPlayer.get(key)
      if (!entry) {
        entry = { name: player.name, iso2: edition.iso2, titles: 0, years: [] }
        byPlayer.set(key, entry)
      }
      entry.titles++
      entry.years.push(edition.year)
    }
  }
  return [...byPlayer.values()]
    .filter((p) => p.titles > 1)
    .sort((a, b) => b.titles - a.titles || (a.years[0] ?? 0) - (b.years[0] ?? 0))
}

// Cuenta campeones ÚNICOS por nombre de campo (club en el torneo o cantera
// juvenil). Un jugador que fue campeón en varias ediciones cuenta una sola vez
// por cada club/cantera, para no inflar a los multi-campeones.
function tally(
  editions: AcademyEdition[],
  pick: (player: AcademyPlayer) => string[],
  clubCountries: Record<string, string>,
): ClubCount[] {
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  for (const edition of editions) {
    for (const player of edition.squad) {
      const key = player.wiki ?? player.name
      for (const name of pick(player)) {
        const pairId = `${key}|${name}`
        if (seen.has(pairId)) continue
        seen.add(pairId)
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, iso2: clubCountries[name] }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function computeHallOfFame(
  editions: AcademyEdition[],
  clubCountries: Record<string, string> = {},
): HallOfFame {
  return {
    players: computePlayers(editions),
    clubs: tally(editions, (p) => (p.club ? [p.club] : []), clubCountries),
    academies: tally(editions, (p) => (p.youth ?? []).map((y) => y.club), clubCountries),
  }
}
