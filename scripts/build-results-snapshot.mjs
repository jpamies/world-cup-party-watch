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
const PLAYERS_OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'players-snapshot.json')

function isFinished(match) {
  return match.ResultType === 1 || Boolean(match.Winner)
}

// Descarga la cronología (timeline) de un partido y devuelve la lista de
// eventos. El endpoint masivo no incluye estos eventos; el timeline por
// partido es la fuente más completa (incluye faltas). Tipos de evento FIFA:
//   0 = gol, 1 = asistencia, 2 = amarilla, 3 = roja, 18 = falta,
//   34 = gol en propia, 41 = gol de penalti, 57 = parada, 71 = revisión VAR.
async function fetchTimelineEvents(idStage, idMatch) {
  const url = `https://api.fifa.com/api/v3/timelines/${FIFA_COMPETITION_ID}/${FIFA_SEASON_ID}/${idStage}/${idMatch}?language=en`
  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data.Event) ? data.Event : []
  } catch {
    return []
  }
}

// Descarga el detalle en vivo de un partido (alineaciones, marcador).
async function fetchMatchDetail(idStage, idMatch) {
  const url = `https://api.fifa.com/api/v3/live/football/${FIFA_COMPETITION_ID}/${FIFA_SEASON_ID}/${idStage}/${idMatch}?language=en`
  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

// Agrega las estadísticas de árbitro a nivel de partido desde los eventos.
function aggregateRefereeStats(events) {
  let yellowCards = 0
  let redCards = 0
  let fouls = 0
  let varReviews = 0
  let penaltyAwarded = 0
  let penaltyGoal = 0
  for (const event of events) {
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
      // Intervención del VAR que corrige la decisión del árbitro.
      case 71:
        varReviews += 1
        break
      // Los penaltis de la tanda están en Period 11; no cuentan.
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
  // "Penalti señalado" (6) suele estar incompleto; usamos el máximo con los
  // goles de penalti (41) para no infravalorar y capturar fallados.
  const penalties = Math.max(penaltyAwarded, penaltyGoal)
  return { yellowCards, redCards, penalties, fouls, varReviews }
}

// Acumula estadísticas por jugador cruzando timeline (goles/asist/paradas)
// con el detalle live (alineaciones/marcador). Muta el mapa `players`.
function accumulatePlayerStats(players, events, detail) {
  const ensure = (id, info) => {
    let p = players.get(id)
    if (!p) {
      p = {
        idPlayer: id,
        name: '',
        teamAbbr: '',
        position: null,
        photo: null,
        matches: 0,
        goals: 0,
        assists: 0,
        saves: 0,
        gkMatches: 0,
        conceded: 0,
        cleanSheets: 0,
      }
      players.set(id, p)
    }
    if (info) {
      if (info.name) p.name = info.name
      if (info.position != null) p.position = info.position
      if (info.teamAbbr) p.teamAbbr = info.teamAbbr
      if (info.photo) p.photo = info.photo
    }
    return p
  }

  if (detail) {
    const teams = [detail.HomeTeam, detail.AwayTeam]
    for (const team of teams) {
      if (!team) continue
      const teamAbbr = team.Abbreviation || team.ShortClubName || ''
      const roster = Array.isArray(team.Players) ? team.Players : []
      const playedIds = new Set()
      for (const pl of roster) {
        if (!pl.IdPlayer) continue
        const name =
          pl.ShortName?.[0]?.Description || pl.PlayerName?.[0]?.Description || ''
        const photo = pl.PlayerPicture?.PictureUrl || null
        ensure(pl.IdPlayer, { name, position: pl.Position, teamAbbr, photo })
        if (pl.Status === 1) playedIds.add(pl.IdPlayer) // titular
      }
      for (const sub of Array.isArray(team.Substitutions) ? team.Substitutions : []) {
        if (sub.IdPlayerOn) playedIds.add(sub.IdPlayerOn) // suplente que entra
      }
      for (const id of playedIds) ensure(id).matches += 1

      // Portero titular: Position 0 y Status 1. Se le imputan los goles
      // encajados (marcador rival) y la portería a cero.
      const startGK = roster.find((pl) => pl.Position === 0 && pl.Status === 1)
      if (startGK && startGK.IdPlayer) {
        const gk = ensure(startGK.IdPlayer)
        gk.gkMatches += 1
        const opponent = team === detail.HomeTeam ? detail.AwayTeam : detail.HomeTeam
        const conceded = Number(opponent?.Score ?? 0) || 0
        gk.conceded += conceded
        if (conceded === 0) gk.cleanSheets += 1
      }
    }
  }

  // Timeline: goles (0) + penaltis en juego (41), asistencias (1), paradas (57).
  // Los goles en propia (34) no se acreditan como gol del jugador.
  for (const e of events) {
    if (!e.IdPlayer) continue
    if (e.Type === 0) ensure(e.IdPlayer).goals += 1
    else if (e.Type === 41 && e.Period !== 11) ensure(e.IdPlayer).goals += 1
    else if (e.Type === 1) ensure(e.IdPlayer).assists += 1
    else if (e.Type === 57) ensure(e.IdPlayer).saves += 1
  }
}

// Construye el detalle del partido (goles y tarjetas con nombre de jugador y
// minuto) desde el live/football, para que el modal funcione 100% offline.
function localizedName(items) {
  if (!Array.isArray(items) || items.length === 0) return null
  const en = items.find((i) => String(i.Locale ?? '').toLowerCase().startsWith('en'))
  return (en ?? items[0])?.Description ?? null
}

function playerLookup(team) {
  const lookup = new Map()
  for (const pl of team?.Players ?? []) {
    if (!pl.IdPlayer) continue
    const name = localizedName(pl.ShortName) || localizedName(pl.PlayerName)
    if (name) lookup.set(pl.IdPlayer, name)
  }
  return lookup
}

// live/football goal Type: 2 = normal, 3 = penalti, 4 = gol en propia.
function mapGoals(team, side) {
  const lookup = playerLookup(team)
  return (team?.Goals ?? []).map((goal) => ({
    side,
    player: (goal.IdPlayer ? lookup.get(goal.IdPlayer) : null) ?? 'Gol',
    minute: goal.Minute ?? '',
    ownGoal: goal.Type === 4,
    penalty: goal.Type === 3,
  }))
}

// live/football booking Card: 1 = amarilla, resto = roja.
function mapCards(team, side) {
  const lookup = playerLookup(team)
  return (team?.Bookings ?? []).map((booking) => ({
    side,
    player: (booking.IdPlayer ? lookup.get(booking.IdPlayer) : null) ?? '—',
    minute: booking.Minute ?? '',
    card: booking.Card === 1 ? 'yellow' : 'red',
  }))
}

function buildMatchEvents(detail) {
  if (!detail) return { goals: [], cards: [] }
  const goals = [
    ...mapGoals(detail.HomeTeam, 'home'),
    ...mapGoals(detail.AwayTeam, 'away'),
  ]
  const cards = [
    ...mapCards(detail.HomeTeam, 'home'),
    ...mapCards(detail.AwayTeam, 'away'),
  ]
  return { goals, cards }
}

// Procesa una lista con un límite de concurrencia para no saturar la API.
async function mapWithConcurrency(items, limit, worker) {  const results = new Array(items.length)
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
    Events: { goals: [], cards: [] },
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

  console.log(`Descargando eventos y jugadores de ${finished.length} partidos…`)
  const players = new Map()
  await mapWithConcurrency(finished, 8, async (match) => {
    const [events, detail] = await Promise.all([
      fetchTimelineEvents(match.IdStage, match.IdMatch),
      fetchMatchDetail(match.IdStage, match.IdMatch),
    ])
    const { yellowCards, redCards, penalties, fouls, varReviews } =
      aggregateRefereeStats(events)
    match.YellowCards = yellowCards
    match.RedCards = redCards
    match.Penalties = penalties
    match.Fouls = fouls
    match.VarReviews = varReviews
    match.Events = buildMatchEvents(detail)
    // El equipo arbitral completo (asistentes, 4º, VAR, AVAR) solo viene en el
    // detalle live/football; el endpoint masivo trae 1-2 oficiales. Usamos el
    // más completo para que la clasificación de árbitros y el modal sean 100%
    // estáticos y no dependan de la API en runtime.
    const detailOfficials = Array.isArray(detail?.Officials)
      ? detail.Officials.map(trimOfficial).filter(Boolean)
      : []
    if (detailOfficials.length > match.Officials.length) {
      match.Officials = detailOfficials
    }
    accumulatePlayerStats(players, events, detail)
  })

  const payload = {
    fetchedAt: new Date().toISOString(),
    Results: finished,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Snapshot escrito: ${OUTPUT_PATH} (${finished.length} partidos finalizados)`)

  // Snapshot de jugadores: solo los que tienen alguna aparición o evento.
  const playersList = [...players.values()]
    .filter(
      (p) =>
        p.matches > 0 ||
        p.goals > 0 ||
        p.assists > 0 ||
        p.saves > 0 ||
        p.gkMatches > 0,
    )
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))

  const playersPayload = {
    fetchedAt: new Date().toISOString(),
    Players: playersList,
  }
  await writeFile(
    PLAYERS_OUTPUT_PATH,
    `${JSON.stringify(playersPayload, null, 2)}\n`,
    'utf8',
  )
  console.log(
    `Snapshot de jugadores escrito: ${PLAYERS_OUTPUT_PATH} (${playersList.length} jugadores)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
