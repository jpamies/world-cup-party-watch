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

// Descarga la cronología (timeline) de un partido y cuenta faltas, tarjetas
// y penaltis. El endpoint masivo no incluye estos eventos; el timeline por
// partido es la fuente más completa (incluye faltas, no disponibles en el
// detalle live). Tipos de evento FIFA:
//   2 = amarilla, 3 = roja, 18 = falta,
//   6 = penalti señalado, 41 = gol de penalti, 71 = revisión VAR.
async function fetchMatchEvents(idStage, idMatch) {
  const url = `https://api.fifa.com/api/v3/timelines/${FIFA_COMPETITION_ID}/${FIFA_SEASON_ID}/${idStage}/${idMatch}?language=en`
  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) {
      return { yellowCards: 0, redCards: 0, penalties: 0, fouls: 0, varReviews: 0 }
    }
    const data = await response.json()
    let yellowCards = 0
    let redCards = 0
    let fouls = 0
    let varReviews = 0
    let penaltyAwarded = 0
    let penaltyGoal = 0
    for (const event of Array.isArray(data.Event) ? data.Event : []) {
      switch (event.Type) {
        case 2:
          yellowCards += 1
          break
        case 3:
          redCards += 1
          break
        case 18:
          fouls += 1
          break
        // Intervención del VAR que corrige la decisión del árbitro
        // (gol otorgado, tarjeta reasignada, roja dada, etc.).
        case 71:
          varReviews += 1
          break
        // Los penaltis de la tanda están en Period 11; no cuentan como
        // penaltis del juego, solo los señalados/anotados durante el partido.
        case 6:
          if (event.Period !== 11) penaltyAwarded += 1
          break
        case 41:
          if (event.Period !== 11) penaltyGoal += 1
          break
        default:
          break
      }
    }
    // "Penalti señalado" (6) suele estar incompleto en la API y a veces
    // reporta menos que goles de penalti (41). Como todo gol de penalti
    // implica un penalti señalado, usamos el máximo para no infravalorar
    // y capturar fallados cuando el evento 6 sí se registró.
    const penalties = Math.max(penaltyAwarded, penaltyGoal)
    return { yellowCards, redCards, penalties, fouls, varReviews }
  } catch {
    return { yellowCards: 0, redCards: 0, penalties: 0, fouls: 0, varReviews: 0 }
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
    YellowCards: 0,
    RedCards: 0,
    Penalties: 0,
    Fouls: 0,
    VarReviews: 0,
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

  console.log(`Descargando faltas, tarjetas, penaltis y VAR de ${finished.length} partidos…`)
  await mapWithConcurrency(finished, 8, async (match) => {
    const { yellowCards, redCards, penalties, fouls, varReviews } = await fetchMatchEvents(
      match.IdStage,
      match.IdMatch,
    )
    match.YellowCards = yellowCards
    match.RedCards = redCards
    match.Penalties = penalties
    match.Fouls = fouls
    match.VarReviews = varReviews
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
