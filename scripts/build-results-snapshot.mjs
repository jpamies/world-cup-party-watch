// Descarga los resultados de la FIFA World Cup 2026 y genera un snapshot
// estático (solo partidos finalizados) que la app usa como base inmediata
// antes de pedir datos en vivo a la API de la FIFA / localStorage.
//
// Uso: node scripts/build-results-snapshot.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const FIFA_COMPETITION_ID = '17'
const FIFA_SEASON_ID = '285023'
const FIFA_MATCHES_URL = `https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idSeason=${FIFA_SEASON_ID}`

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'results-snapshot.json')

function isFinished(match) {
  return match.ResultType === 1 || Boolean(match.Winner)
}

// Descarga el detalle en vivo de un partido y cuenta tarjetas y penaltis.
// El endpoint masivo no incluye estos eventos, solo el detalle por partido.
async function fetchMatchEvents(idStage, idMatch) {
  const url = `https://api.fifa.com/api/v3/live/football/${FIFA_COMPETITION_ID}/${FIFA_SEASON_ID}/${idStage}/${idMatch}?language=en`
  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) {
      return { cards: 0, penalties: 0 }
    }
    const data = await response.json()
    let cards = 0
    let penalties = 0
    for (const team of [data.HomeTeam, data.AwayTeam]) {
      if (!team) continue
      cards += Array.isArray(team.Bookings) ? team.Bookings.length : 0
      // FIFA goal Type 3 = penalty scored.
      penalties += Array.isArray(team.Goals)
        ? team.Goals.filter((goal) => goal.Type === 3).length
        : 0
    }
    return { cards, penalties }
  } catch {
    return { cards: 0, penalties: 0 }
  }
}

// Procesa una lista con un límite de concurrencia para no saturar la API.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current], current)
    }
  })
  await Promise.all(runners)
  return results
}

// Recorta un partido FIFA a los campos que consume toLiveMatchSnapshot().
function trimTeam(team) {
  if (!team || typeof team !== 'object') {
    return null
  }
  return {
    Score: team.Score ?? null,
    IdCountry: team.IdCountry ?? null,
    TeamName: Array.isArray(team.TeamName) ? team.TeamName : undefined,
    Abbreviation: team.Abbreviation ?? null,
    ShortClubName: team.ShortClubName ?? null,
  }
}

// Recorta un miembro del equipo arbitral a lo que consume toMatchOfficials().
function trimOfficial(official) {
  if (!official || typeof official !== 'object') {
    return null
  }
  return {
    OfficialId: official.OfficialId ?? null,
    IdCountry: official.IdCountry ?? null,
    Name: Array.isArray(official.Name) ? official.Name : undefined,
    NameShort: Array.isArray(official.NameShort) ? official.NameShort : undefined,
    OfficialType: official.OfficialType ?? null,
    TypeLocalized: Array.isArray(official.TypeLocalized) ? official.TypeLocalized : undefined,
  }
}

function trimMatch(match) {
  return {
    IdMatch: match.IdMatch,
    IdStage: match.IdStage ?? null,
    MatchNumber: match.MatchNumber,
    HomeTeamScore: match.HomeTeamScore ?? null,
    AwayTeamScore: match.AwayTeamScore ?? null,
    HomeTeamPenaltyScore: match.HomeTeamPenaltyScore ?? null,
    AwayTeamPenaltyScore: match.AwayTeamPenaltyScore ?? null,
    MatchTime: match.MatchTime ?? null,
    Winner: match.Winner ?? null,
    ResultType: match.ResultType ?? null,
    Home: trimTeam(match.Home),
    Away: trimTeam(match.Away),
    Officials: Array.isArray(match.Officials)
      ? match.Officials.map(trimOfficial).filter(Boolean)
      : [],
    Cards: 0,
    Penalties: 0,
  }
}

async function main() {
  console.log(`Descargando resultados de la FIFA…`)
  const response = await fetch(FIFA_MATCHES_URL, { credentials: 'omit' })
  if (!response.ok) {
    throw new Error(`No se pudo cargar la API de la FIFA (${response.status})`)
  }

  const raw = await response.json()
  if (!raw || !Array.isArray(raw.Results)) {
    throw new Error('Formato inesperado de la API de la FIFA')
  }

  const finished = raw.Results
    .filter((item) => item && typeof item === 'object')
    .filter(isFinished)
    .map(trimMatch)
    .sort((a, b) => Number(a.MatchNumber) - Number(b.MatchNumber))

  console.log(`Descargando tarjetas y penaltis de ${finished.length} partidos…`)
  await mapWithConcurrency(finished, 8, async (match) => {
    const { cards, penalties } = await fetchMatchEvents(match.IdStage, match.IdMatch)
    match.Cards = cards
    match.Penalties = penalties
  })

  const payload = {
    fetchedAt: new Date().toISOString(),
    Results: finished,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Snapshot escrito: ${OUTPUT_PATH} (${finished.length} partidos finalizados)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
