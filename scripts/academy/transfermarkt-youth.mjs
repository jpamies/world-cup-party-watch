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

// --- Aplica youth-proposals.json a champions.json sin volver a scrapear ---
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
      p.youth = youth
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
