// Extrae "Clubes juveniles" desde los perfiles de Transfermarkt y (opcionalmente)
// rellena el campo `youth` de public/academy/data/champions.json.
//
// Transfermarkt responde a peticiones con User-Agent de navegador (status 200),
// así que se puede scrapear directamente sin herramientas externas.
//
// Funciones exportadas (para usar desde un agente o importando el módulo):
//   searchCandidates(name)      -> [{ id, slug, name }]   (orden de relevancia)
//   fetchProfile(id)            -> { id, name, dob, birthYear, nationality, position, youth }
//   resolvePlayer(entry)        -> { id, name, youth, confidence, matchedOn } | null
//
// CLI:
//   node scripts/academy/transfermarkt-youth.mjs --id 96577
//   node scripts/academy/transfermarkt-youth.mjs "Heinz Kwiatkowski"
//   node scripts/academy/transfermarkt-youth.mjs "Heinz Kwiatkowski" --dob 1926-07-16 --nat de
//   node scripts/academy/transfermarkt-youth.mjs --all --only-missing --limit 5      (dry-run)
//   node scripts/academy/transfermarkt-youth.mjs --all --only-missing --write         (aplica)
//   node scripts/academy/transfermarkt-youth.mjs --stats
//
// El modo --all (sin --write) escribe una propuesta en
// scripts/academy/youth-proposals.json para revisión; con --write actualiza
// champions.json solo en las coincidencias de alta confianza.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = resolve(__dirname, '..', '..', 'public', 'academy', 'data', 'champions.json')
const PROPOSALS_PATH = resolve(__dirname, 'youth-proposals.json')

const BASE = 'https://www.transfermarkt.es'
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml',
}

// Nacionalidad de champions.json (iso2) -> nombre en Transfermarkt (es).
const NAT_BY_ISO2 = {
  de: 'Alemania',
  br: 'Brasil',
  it: 'Italia',
  es: 'España',
  ar: 'Argentina',
  uy: 'Uruguay',
  fr: 'Francia',
  'gb-eng': 'Inglaterra',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function httpGet(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (res.status === 429 || res.status >= 500) throw new Error(`http ${res.status}`)
    if (!res.ok) throw new Error(`http ${res.status}`)
    return await res.text()
  } catch (err) {
    if (attempt < 3) {
      await sleep(1000 * (attempt + 1))
      return httpGet(url, attempt + 1)
    }
    throw err
  }
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

// --- Búsqueda rápida: devuelve candidatos en orden de relevancia ---
export async function searchCandidates(name, limit = 6) {
  const html = await httpGet(`${BASE}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(name)}`)
  const re = /href="\/([a-z0-9-]+)\/profil\/spieler\/(\d+)"[^>]*>([^<]*)</g
  const out = []
  const seen = new Set()
  let m
  while ((m = re.exec(html)) && out.length < limit) {
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, slug: m[1], name: decode(m[3]) || m[1] })
  }
  return out
}

// --- Perfil del jugador: datos + clubes juveniles ---
export async function fetchProfile(id) {
  const html = await httpGet(`${BASE}/-/profil/spieler/${id}`)

  const dobMatch = html.match(/\/datum\/(\d{4})-(\d{2})-(\d{2})/)
  const dob = dobMatch ? `${dobMatch[1]}-${dobMatch[2]}-${dobMatch[3]}` : null
  const birthYear = dobMatch ? Number(dobMatch[1]) : null

  const natMatch = html.match(/Nacionalidad:[\s\S]{0,260}?title="([^"]+)"/)
  const nationality = natMatch ? decode(natMatch[1]) : null

  const nameMatch = html.match(/<h1[^>]*class="data-header__headline-wrapper"[^>]*>([\s\S]*?)<\/h1>/)
  const name = nameMatch ? decode(nameMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) : null

  const posMatch = html.match(/Posición:<\/span>\s*<span[^>]*>([^<]+)</)
  const position = posMatch ? decode(posMatch[1]) : null

  // Badge de "Campeón del Mundo" (logro TM 101). Presente en campeones de todas
  // las épocas (verificado 1930-1994), así que sirve para descartar homónimos.
  const worldChampion =
    html.includes('title="Campeón del Mundo"') || /erfolge\/header\/101\./.test(html)

  const youth = parseYouth(html)
  return { id, name, dob, birthYear, nationality, position, worldChampion, youth }
}

function parseYouth(html) {
  const box = html.match(/Clubes juveniles<\/h2>\s*<div class="content">([\s\S]*?)<\/div>/)
  if (!box) return []
  // Los clubes vienen en una sola línea separados por comas: "Club (años), Club (años)".
  const inner = decode(
    box[1]
      .replace(/<br\s*\/?>/g, ', ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  )
  if (!inner) return []
  return inner
    .split(',')
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
      return m ? { club: m[1].trim(), years: m[2].trim() } : { club: tok, years: null }
    })
    .filter((y) => y.club)
}

// Nombres de "sin club" en el historial de fichajes de TM (varios idiomas).
const UNKNOWN_CLUBS = new Set([
  'desconocido',
  'sin club',
  'sin equipo',
  'unknown',
  'without club',
  'vereinslos',
  'unbekannt',
  'eigene jugend',
  'eigene juvenil',
  'retirada',
  'retired',
  'carrera finalizada',
  'fin de carrera',
  'karriereende',
  '-',
  '',
])
const isUnknownClub = (n) => UNKNOWN_CLUBS.has((n ?? '').toLowerCase().trim())

// Alias de nombres abreviados de TM (sobre todo de sus equipos juveniles) al
// nombre canónico del club, para que no se dupliquen en el ranking.
// Nombres abreviados/variantes de Transfermarkt -> nombre canónico del club,
// para que el mismo club no se duplique en el ranking de canteras. Clave en
// minúsculas. Solo se incluyen equivalencias inequívocas.
const CLUB_ALIAS = {
  'barça': 'Barcelona',
  'fc barcelona': 'Barcelona',
  'fc bayern münchen': 'Bayern München',
  "k'lautern": 'Kaiserslautern',
  '1.fc kaiserslautern': 'Kaiserslautern',
  '1. fc kaiserslautern': 'Kaiserslautern',
  'man utd': 'Manchester United',
  'boca': 'Boca Juniors',
  'cabj': 'Boca Juniors',
  "indep'te": 'Independiente',
  'vcf': 'Valencia',
  'fc valencia': 'Valencia',
  'villarreal cf': 'Villarreal',
  'fc villarreal': 'Villarreal',
  "m'gladbach": 'Borussia Mönchengladbach',
  'ol. lyon': 'Olympique Lyonnais',
  'olymp. lyon': 'Olympique Lyonnais',
  'psg': 'Paris Saint-Germain',
  'milan': 'AC Milan',
  'roma': 'AS Roma',
  'as rom': 'AS Roma',
  'provercelli': 'Pro Vercelli',
  'fc pro vercelli 1892': 'Pro Vercelli',
  'botafogo rio de janeiro': 'Botafogo',
  'flamengo rio de janeiro': 'Flamengo',
  'gremio porto alegre': 'Grêmio',
  'ec cruzeiro belo horizonte': 'Cruzeiro',
  'rw essen': 'Rot-Weiss Essen',
  'fc santos': 'Santos FC',
  'gr. fürth': 'Greuther Fürth',
  'st. kickers': 'Stuttgarter Kickers',
  'estudiantes lp': 'Estudiantes',
}

// Devuelve el nombre canónico de un club (aplica el alias si existe).
function canonicalizeClub(name) {
  const s = (name ?? '').trim()
  return CLUB_ALIAS[s.toLowerCase()] || s
}

// Expansión de abreviaturas de prefijo de TM al nombre completo. Solo prefijos
// inequívocos: "R. Madrid" -> "Real Madrid", "Atl. Madrid" -> "Atlético Madrid".
const ABBR_PREFIX = [
  [/^R\.\s+/i, 'Real '],
  [/^Atl[eé]?t?\.\s+/i, 'Atlético '],
  [/^At\.\s+/i, 'Atlético '],
  [/^Dep\.\s+/i, 'Deportivo '],
  [/^Sp\.\s+/i, 'Sporting '],
]

// Marcadores que identifican un equipo juvenil/filial dentro del historial de
// fichajes (para incluirlo como cantera y no como club sénior).
const YOUTH_MARKERS = [
  /\bU-?\d{2}\b/i,
  /\bSub-?\d{2}\b/i,
  /\bJgd\.?\b/i,
  /\bJuv\.?\b/i,
  /\bJuvenil\b/i,
  /\bCad\.?\b/i,
  /\bCadete\b/i,
  /\bInf\.?\b/i,
  /\bAlev\.?\b/i,
  /\bF\.?\s?base\b/i,
  /\bF[uú]tb\.?\s?base\b/i,
  /\bYouth\b/i,
  /\bYth\.?\b/i,
  /\bAmateure?\b/i,
  /\bReserves?\b/i,
  /\s(B|II|III)$/,
]
const isYouthClubName = (n) => YOUTH_MARKERS.some((re) => re.test(n || ''))

// ¿Son el mismo club? (uno contiene al otro sin sufijos: "Albacete" ~ "Albacete Balompié").
// Se ignoran los puntos para que abreviaturas de TM ("Villarr." ~ "FC Villarreal",
// "RC Celta" ~ "Celta") se dedupliquen. No se recorta a la ciudad para no fusionar
// clubes distintos (p. ej. Real Madrid vs Atlético Madrid).
function sameClub(a, b) {
  const x = (a || '').toLowerCase().replace(/\./g, '').trim()
  const y = (b || '').toLowerCase().replace(/\./g, '').trim()
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

// Normaliza filiales/juveniles al club matriz: "Quilmes U20" -> "Quilmes",
// "Bologna U19" -> "Bologna", "Barça Cad. A" -> "Barcelona" (vía alias).
export function normalizeParentClub(name) {
  if (!name) return null
  let s = name.trim()
  const suffixes = [
    /\s+U-?\d{2}$/i, // U23, U-19, U17...
    /\s+Sub-?\d{2}$/i, // Sub-20
    /\s+Jgd\.?$/i, // Jugend (juvenil)
    /\s+Juvenil\.?\s*[A-C]?$/i, // Juvenil (A/B/C)
    /\s+Juv\.?\s*[A-C]?$/i, // Juv. / Juv.A
    /\s+Cadete\.?\s*[A-C]?$/i, // Cadete
    /\s+Cad\.?\s*[A-C]?$/i, // Cad. / Cad.A
    /\s+Infantil\.?\s*[A-C]?$/i, // Infantil
    /\s+Inf\.?\s*[A-C]?$/i, // Inf.
    /\s+Alev[ií]n\.?\s*[A-C]?$/i, // Alevín
    /\s+Alev\.?\s*[A-C]?$/i, // Alev.
    /\s+F[uú]tb\.?\s?base$/i, // Fútbol base
    /\s+F\.?\s?base$/i,
    /\s+Jr\.?$/i,
    /\s+Junior(?:s)?$/i,
    /\s+Youth$/i,
    /\s+Yth\.?$/i,
    /\s+Reserves?$/i,
    /\s+Res\.?$/i,
    /\s+Amateure?$/i,
    /-Amateure?$/i,
    /\s+B$/, // filial "B" (solo mayúscula, para no tocar nombres reales)
    /\s+II$/,
    /\s+III$/,
  ]
  let changed = true
  while (changed) {
    changed = false
    for (const re of suffixes) {
      if (re.test(s)) {
        s = s.replace(re, '').trim()
        changed = true
      }
    }
  }
  // Expande abreviaturas de prefijo habituales de TM (seguras, sin ambigüedad de ciudad).
  for (const [re, full] of ABBR_PREFIX) s = s.replace(re, full)
  return CLUB_ALIAS[s.toLowerCase()] || s || name.trim()
}

// Historial de fichajes (endpoint JSON de TM), de más reciente a más antiguo.
async function fetchTransfers(id) {
  const url = `${BASE}/ceapi/transferHistory/list/${id}`
  try {
    const res = await fetch(url, { headers: { ...HEADERS, Accept: 'application/json' } })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json?.transfers) ? json.transfers : []
  } catch {
    return []
  }
}

// Primer club de la carrera (origen del fichaje más antiguo, o destino si el
// origen es "Desconocido").
export async function fetchFirstClub(id) {
  const transfers = await fetchTransfers(id)
  if (!transfers.length) return null
  const first = transfers[transfers.length - 1]
  const fromName = (first?.from?.clubName ?? '').trim()
  const toName = (first?.to?.clubName ?? '').trim()
  const pick = !isUnknownClub(fromName) ? fromName : !isUnknownClub(toName) ? toName : null
  return pick ? normalizeParentClub(pick) : null
}

// Deriva la cantera combinando la sección "Clubes juveniles" con los equipos
// juveniles que aparecen en el historial de fichajes. Si no hay ninguno, usa el
// primer club (marcado con assigned:true → se muestra con * en la web).
export async function deriveYouthClubs(id) {
  const profile = await fetchProfile(id).catch(() => null)
  const transfers = await fetchTransfers(id)
  const youth = []
  const add = (club, years = null, assigned = false) => {
    if (!club) return
    const hit = youth.find((y) => sameClub(y.club, club))
    if (hit) {
      if (club.length > hit.club.length) hit.club = club // conserva el nombre más completo
      if (!hit.years && years) hit.years = years
      return
    }
    youth.push({ club, years, ...(assigned ? { assigned: true } : {}) })
  }
  // 1) Sección "Clubes juveniles".
  for (const y of profile?.youth ?? []) add(normalizeParentClub(y.club), y.years)
  // 2) Equipos juveniles del historial (más antiguo → más reciente).
  for (let i = transfers.length - 1; i >= 0; i--) {
    for (const side of [transfers[i]?.from, transfers[i]?.to]) {
      const n = side?.clubName
      if (n && !isUnknownClub(n) && isYouthClubName(n)) add(normalizeParentClub(n))
    }
  }
  // 3) Fallback: primer club real.
  if (!youth.length && transfers.length) {
    const first = transfers[transfers.length - 1]
    const fromName = (first?.from?.clubName ?? '').trim()
    const toName = (first?.to?.clubName ?? '').trim()
    const pick = !isUnknownClub(fromName) ? fromName : !isUnknownClub(toName) ? toName : null
    add(normalizeParentClub(pick), null, true)
  }
  return youth
}

// --- Resolver: elige el candidato correcto usando año de nacimiento y país ---
export async function resolvePlayer(entry, { candidates = 5, throttle = 500 } = {}) {
  const wantYear = entry.dob ? Number(entry.dob.slice(0, 4)) : null
  const wantNat = NAT_BY_ISO2[entry.iso2] ?? null
  const list = await searchCandidates(entry.name, candidates)
  let best = null
  for (const cand of list) {
    await sleep(throttle)
    let profile
    try {
      profile = await fetchProfile(cand.id)
    } catch {
      continue
    }
    let score = 0
    const matchedOn = []
    let dobExact = false
    let natMatch = false
    // La nacionalidad es el desempate principal: si no coincide, es otro jugador.
    if (wantNat && profile.nationality) {
      if (profile.nationality === wantNat) {
        score += 3
        matchedOn.push('nat')
        natMatch = true
      } else {
        score -= 6
      }
    }
    if (wantYear && profile.birthYear) {
      const diff = Math.abs(profile.birthYear - wantYear)
      if (diff === 0) {
        score += 3
        matchedOn.push('dob')
        dobExact = true
      } else if (diff <= 1) {
        score += 1
        matchedOn.push('dob~')
      } else {
        score -= 3
      }
    }
    // El badge solo confirma que es campeón del mundo (de algún año); no basta por
    // sí solo para desambiguar homónimos que también lo fueron (p.ej. T. Müller).
    if (profile.worldChampion) {
      score += 2
      matchedOn.push('wc')
    } else {
      score -= 3
    }
    if (profile.youth.length) score += 0.3
    const result = {
      id: cand.id,
      name: profile.name,
      nationality: profile.nationality,
      birthYear: profile.birthYear,
      worldChampion: profile.worldChampion,
      youth: profile.youth,
      score,
      matchedOn,
    }
    if (!best || score > best.score) best = result
    // Coincidencia fuerte: campeón del mundo + fecha exacta → no seguir. Si conocemos
    // la fecha, no cortamos solo por nacionalidad (evita elegir a un homónimo del
    // mismo país antes de llegar al perfil con la fecha correcta).
    if (profile.worldChampion && (dobExact || (natMatch && !wantYear))) break
  }
  if (!best) return null
  const confidence =
    best.score >= 5 ? 'high' : best.score >= 3 ? 'medium' : best.score >= 1 ? 'low' : 'none'
  return { ...best, confidence, matchedOn: best.matchedOn }
}

// --- Recorre champions.json ---
function uniquePlayers(data, onlyMissing) {
  const byKey = new Map()
  for (const edition of data.editions ?? []) {
    for (const p of edition.squad ?? []) {
      const key = p.wiki ?? p.name
      const hasYouth = Array.isArray(p.youth) && p.youth.length > 0
      if (!byKey.has(key)) {
        byKey.set(key, { key, name: p.name, dob: p.dob, iso2: edition.iso2, hasYouth, entries: [] })
      }
      const rec = byKey.get(key)
      rec.entries.push(p)
      if (hasYouth) rec.hasYouth = true
    }
  }
  const all = [...byKey.values()]
  return onlyMissing ? all.filter((r) => !r.hasYouth) : all
}

function stats() {
  return readFile(DATA_PATH, 'utf8').then((raw) => {
    const data = JSON.parse(raw)
    const all = uniquePlayers(data, false)
    const missing = all.filter((r) => !r.hasYouth)
    console.log(`Jugadores únicos: ${all.length}`)
    console.log(`Con cantera:      ${all.length - missing.length}`)
    console.log(`Sin cantera:      ${missing.length}`)
  })
}

function existingYouthOf(entries) {
  for (const e of entries) {
    if (Array.isArray(e.youth) && e.youth.length > 0) return e.youth
  }
  return []
}

function youthKey(list) {
  return (list ?? [])
    .map((y) => `${(y.club ?? '').toLowerCase().trim()}|${(y.years ?? '').toString().trim()}`)
    .join(';')
}

async function readExistingProposals() {
  try {
    return JSON.parse(await readFile(PROPOSALS_PATH, 'utf8'))
  } catch {
    return []
  }
}

async function runAll({ onlyMissing, limit, offset, write, throttle }) {
  const raw = await readFile(DATA_PATH, 'utf8')
  const data = JSON.parse(raw)
  let players = uniquePlayers(data, onlyMissing)
  const start = offset ?? 0
  players = players.slice(start, limit ? start + limit : undefined)

  const proposals = []
  let applied = 0
  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    const existingYouth = existingYouthOf(p.entries)
    process.stdout.write(`[${i + 1}/${players.length}] ${p.name} ... `)
    let res = null
    try {
      res = await resolvePlayer({ name: p.name, dob: p.dob, iso2: p.iso2 }, { throttle })
    } catch (err) {
      console.log(`ERROR ${err.message}`)
    }
    // Solo aceptamos la cantera si el perfil es Campeón del Mundo Y coincide país
    // o fecha de nacimiento. Si no, es un homónimo: no proponemos su cantera.
    const identified =
      res && res.worldChampion === true && (res.matchedOn.includes('nat') || res.matchedOn.includes('dob'))
    const proposedYouth = identified ? res.youth : []
    const differs = youthKey(existingYouth) !== youthKey(proposedYouth)
    proposals.push({
      key: p.key,
      name: p.name,
      dob: p.dob ?? null,
      iso2: p.iso2,
      tmId: res ? res.id : null,
      tmName: res ? res.name : null,
      tmNationality: res ? (res.nationality ?? null) : null,
      worldChampion: res ? res.worldChampion === true : false,
      confidence: identified ? res.confidence : 'none',
      matchedOn: res ? res.matchedOn : [],
      existingYouth,
      proposedYouth,
      differs,
    })
    if (identified && proposedYouth.length) {
      console.log(`${res.confidence}${differs ? ' *' : ''} → ${proposedYouth.map((y) => y.club).join(', ')}`)
    } else if (res && !identified) {
      console.log(`descartado: ${res.name} (${res.nationality ?? '?'}, wc=${res.worldChampion})`)
    } else {
      console.log('sin cantera')
    }
    if (write && identified && res.confidence === 'high' && proposedYouth.length) {
      for (const entry of p.entries) entry.youth = proposedYouth
      applied++
    }
    await sleep(throttle)
  }

  // Fusiona (upsert por key) con propuestas previas para permitir tandas con --offset.
  const merged = new Map()
  for (const prev of await readExistingProposals()) merged.set(prev.key, prev)
  for (const cur of proposals) merged.set(cur.key, cur)
  const all = [...merged.values()]
  await writeFile(PROPOSALS_PATH, JSON.stringify(all, null, 2), 'utf8')
  const found = proposals.filter((p) => p.proposedYouth.length).length
  const conflicts = proposals.filter((p) => p.differs && p.proposedYouth.length).length
  console.log(`\nPropuestas escritas: ${PROPOSALS_PATH} (acumulado: ${all.length})`)
  console.log(`  total: ${proposals.length} · con cantera TM: ${found} · difieren del actual: ${conflicts}`)
  if (write) {
    await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
    console.log(`champions.json actualizado: ${applied} jugadores (confianza alta)`)
  }
}

// --- Deriva la cantera de cada campeón identificado combinando la sección
//     "Clubes juveniles" con los equipos juveniles del historial de fichajes; si
//     no hay ninguno usa el primer club (marcado assigned:true → * en la web). ---
async function deriveAllYouth({ throttle = 300 } = {}) {
  const proposals = await readExistingProposals()
  let scanned = 0
  let withYouth = 0
  let keptWiki = 0
  let onlyFirst = 0
  for (const p of proposals) {
    const identified =
      p.tmId &&
      p.worldChampion === true &&
      Array.isArray(p.matchedOn) &&
      (p.matchedOn.includes('nat') || p.matchedOn.includes('dob'))
    // Solo tocamos jugadores identificados de forma fiable (no homónimos).
    if (!identified) continue
    scanned++
    process.stdout.write(`[${scanned}] ${p.name} (tm ${p.tmId}) ... `)
    let youth = []
    try {
      youth = await deriveYouthClubs(p.tmId)
    } catch (err) {
      console.log(`ERROR ${err.message}`)
      continue
    }
    const hasRealYouth = youth.some((y) => !y.assigned)
    if (hasRealYouth) {
      // Cantera juvenil real (sección + historial). Es lo mejor: reemplaza.
      p.proposedYouth = youth
      p.confidence = 'reviewed'
      p.firstClubAssigned = false
      withYouth++
      console.log(`→ ${youth.map((y) => y.club).join(', ')}`)
    } else {
      // TM no tiene juvenil. Si Wikipedia ya tenía una cantera limpia, se conserva
      // (suele ser más rica); si no, se usa el primer club (*).
      const cleanWiki = cleanYouthList(p.existingYouth)
      if (cleanWiki.length) {
        p.proposedYouth = cleanWiki
        p.confidence = 'reviewed'
        p.firstClubAssigned = false
        keptWiki++
        console.log(`(wiki) → ${cleanWiki.map((y) => y.club).join(', ')}`)
      } else if (youth.length) {
        p.proposedYouth = youth
        p.confidence = 'reviewed'
        p.firstClubAssigned = true
        onlyFirst++
        console.log(`(1er club) → ${youth.map((y) => y.club + '*').join(', ')}`)
      } else {
        console.log('sin datos TM (se conserva la actual)')
      }
    }
    await sleep(throttle)
  }
  await writeFile(PROPOSALS_PATH, JSON.stringify(proposals, null, 2), 'utf8')
  console.log(
    `\nCantera derivada para ${scanned} identificados: ${withYouth} juvenil TM, ${keptWiki} juvenil Wikipedia, ${onlyFirst} solo primer club (*). Ejecuta --apply para volcar a champions.json.`,
  )
}

// Descarta entradas de cantera con parse roto (artefactos de plantilla de Wikipedia).
function cleanYouthList(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((y) => {
      const blob = `${y?.club ?? ''} ${y?.years ?? ''}`
      return y?.club && y.club.length >= 2 && !/[|={}<>]|youthclubs|youthyears|nbsp|&amp;/i.test(blob)
    })
    .map((y) => ({ club: y.club, years: y.years ?? null }))
}

// --- Aplica youth-proposals.json a champions.json sin volver a scrapear ---
// Canonicaliza los nombres de club de una lista de cantera y deduplica por
// nombre canónico (conserva años y la marca assigned del primer elemento).
function canonicalizeYouth(list) {
  const out = []
  for (const y of list ?? []) {
    const club = canonicalizeClub(y.club)
    if (!club) continue
    const hit = out.find((o) => o.club === club)
    if (hit) {
      if (!hit.years && y.years) hit.years = y.years
      continue
    }
    out.push({ club, years: y.years ?? null, ...(y.assigned ? { assigned: true } : {}) })
  }
  return out
}

async function applyProposals({ minConfidence = ['high', 'reviewed'] } = {}) {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'))
  const proposals = await readExistingProposals()
  const byKey = new Map()
  for (const p of proposals) {
    if (!minConfidence.includes(p.confidence)) continue
    if (!Array.isArray(p.proposedYouth) || p.proposedYouth.length === 0) continue
    byKey.set(p.key, p.proposedYouth)
  }
  let applied = 0
  let players = 0
  for (const edition of data.editions ?? []) {
    for (const p of edition.squad ?? []) {
      const key = p.wiki ?? p.name
      const youth = byKey.get(key)
      if (!youth) continue
      p.youth = canonicalizeYouth(youth)
      applied++
      players++
    }
  }
  data.youthScrapedAt = new Date().toISOString()
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`champions.json actualizado: ${applied} filas de plantilla (${byKey.size} jugadores propuestos)`) 
}

// --- CLI ---
function arg(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : null
}
function has(flag) {
  return process.argv.includes(flag)
}

async function main() {
  const argv = process.argv.slice(2)
  if (has('--stats')) return stats()
  if (has('--derive-youth'))
    return deriveAllYouth({ throttle: arg('--throttle') ? Number(arg('--throttle')) : 300 })
  if (has('--apply')) return applyProposals()

  if (has('--all')) {
    return runAll({
      onlyMissing: has('--only-missing'),
      limit: arg('--limit') ? Number(arg('--limit')) : null,
      offset: arg('--offset') ? Number(arg('--offset')) : 0,
      write: has('--write'),
      throttle: arg('--throttle') ? Number(arg('--throttle')) : 500,
    })
  }

  const id = arg('--id')
  if (id) {
    console.log(JSON.stringify(await fetchProfile(id), null, 2))
    return
  }

  const name = argv.find((a) => !a.startsWith('--'))
  if (!name) {
    console.log('Uso: node transfermarkt-youth.mjs "Nombre" | --id N | --all | --stats')
    return
  }
  const dob = arg('--dob')
  const nat = arg('--nat')
  if (dob || nat) {
    const res = await resolvePlayer({ name, dob, iso2: nat })
    console.log(JSON.stringify(res, null, 2))
  } else {
    const cands = await searchCandidates(name)
    console.log(JSON.stringify(cands, null, 2))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
