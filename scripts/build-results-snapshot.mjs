// Descarga los resultados de la FIFA World Cup 2026 y genera un snapshot
// estático (solo partidos finalizados) que la app usa como base inmediata
// antes de pedir datos en vivo a la API de la FIFA / localStorage.
//
// Uso: node scripts/build-results-snapshot.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const FIFA_SEASON_ID = '285023'
const FIFA_MATCHES_URL = `https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idSeason=${FIFA_SEASON_ID}`

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'results-snapshot.json')

function isFinished(match) {
  return match.ResultType === 1 || Boolean(match.Winner)
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
