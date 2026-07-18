// Scrapea de Wikipedia las plantillas campeonas de cada Mundial (1930-2022)
// y genera public/academy/data/champions.json que consume la página /academy.
//
// Fuente: "{YEAR}_FIFA_World_Cup_squads?action=raw" (wikitext).
// Por jugador extrae: dorsal, posición, nombre, fecha de nacimiento, caps,
// goles (si constan) y club en el torneo. También el seleccionador.
//
// Uso: node scripts/academy/scrape-champions.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '..', '..', 'public', 'academy', 'data', 'champions.json')

// Metadatos fijos por edición. `champion` debe coincidir con el encabezado
// de sección en la página de squads de Wikipedia (===Champion===).
const EDITIONS = [
  { year: 1930, host: 'Uruguay', champion: 'Uruguay', iso2: 'uy', runnerUp: 'Argentina', score: '4–2' },
  { year: 1934, host: 'Italy', champion: 'Italy', iso2: 'it', runnerUp: 'Czechoslovakia', score: '2–1 (a.e.t.)' },
  { year: 1938, host: 'France', champion: 'Italy', iso2: 'it', runnerUp: 'Hungary', score: '4–2' },
  { year: 1950, host: 'Brazil', champion: 'Uruguay', iso2: 'uy', runnerUp: 'Brazil', score: '2–1' },
  { year: 1954, host: 'Switzerland', champion: 'West Germany', iso2: 'de', runnerUp: 'Hungary', score: '3–2' },
  { year: 1958, host: 'Sweden', champion: 'Brazil', iso2: 'br', runnerUp: 'Sweden', score: '5–2' },
  { year: 1962, host: 'Chile', champion: 'Brazil', iso2: 'br', runnerUp: 'Czechoslovakia', score: '3–1' },
  { year: 1966, host: 'England', champion: 'England', iso2: 'gb-eng', runnerUp: 'West Germany', score: '4–2 (a.e.t.)' },
  { year: 1970, host: 'Mexico', champion: 'Brazil', iso2: 'br', runnerUp: 'Italy', score: '4–1' },
  { year: 1974, host: 'West Germany', champion: 'West Germany', iso2: 'de', runnerUp: 'Netherlands', score: '2–1' },
  { year: 1978, host: 'Argentina', champion: 'Argentina', iso2: 'ar', runnerUp: 'Netherlands', score: '3–1 (a.e.t.)' },
  { year: 1982, host: 'Spain', champion: 'Italy', iso2: 'it', runnerUp: 'West Germany', score: '3–1' },
  { year: 1986, host: 'Mexico', champion: 'Argentina', iso2: 'ar', runnerUp: 'West Germany', score: '3–2' },
  { year: 1990, host: 'Italy', champion: 'West Germany', iso2: 'de', runnerUp: 'Argentina', score: '1–0' },
  { year: 1994, host: 'United States', champion: 'Brazil', iso2: 'br', runnerUp: 'Italy', score: '0–0 (3–2 pen.)' },
  { year: 1998, host: 'France', champion: 'France', iso2: 'fr', runnerUp: 'Brazil', score: '3–0' },
  { year: 2002, host: 'South Korea / Japan', champion: 'Brazil', iso2: 'br', runnerUp: 'Germany', score: '2–0' },
  { year: 2006, host: 'Germany', champion: 'Italy', iso2: 'it', runnerUp: 'France', score: '1–1 (5–3 pen.)' },
  { year: 2010, host: 'South Africa', champion: 'Spain', iso2: 'es', runnerUp: 'Netherlands', score: '1–0 (a.e.t.)' },
  { year: 2014, host: 'Brazil', champion: 'Germany', iso2: 'de', runnerUp: 'Argentina', score: '1–0 (a.e.t.)' },
  { year: 2018, host: 'Russia', champion: 'France', iso2: 'fr', runnerUp: 'Croatia', score: '4–2' },
  { year: 2022, host: 'Qatar', champion: 'Argentina', iso2: 'ar', runnerUp: 'France', score: '3–3 (4–2 pen.)' },
]

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Extrae el texto visible de un wikilink: [[Page|Display]] -> Display, [[Page]] -> Page.
function unlink(value) {
  if (!value) return ''
  let v = value.trim()
  const link = v.match(/\[\[([^\]]+)\]\]/)
  if (link) {
    const inner = link[1]
    const pipe = inner.lastIndexOf('|')
    v = pipe >= 0 ? inner.slice(pipe + 1) : inner
  }
  return v
    .replace(/''+/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<ref.*?<\/ref>/gs, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

// De un template de fecha de nacimiento saca YYYY-MM-DD.
// Soporta {{birth date and age2|df=y|REFy|REFm|REFd|BY|BM|BD}} (6 ints -> últimos 3)
// y {{birth date|BY|BM|BD}} / {{birth date and age|BY|BM|BD}} (3 ints -> esos 3).
function extractDob(line) {
  const tpl = line.match(/\{\{\s*[Bb]irth date[^}]*\}\}/)
  if (!tpl) return null
  const ints = (tpl[0].match(/\d+/g) || []).map(Number).filter((n) => n > 0)
  let y, m, d
  if (ints.length >= 6) {
    ;[y, m, d] = ints.slice(-3)
  } else if (ints.length >= 3) {
    ;[y, m, d] = ints.slice(0, 3)
  } else {
    return null
  }
  if (!y || !m || !d || m > 12 || d > 31) return null
  const pad = (n) => String(n).padStart(2, '0')
  return `${y}-${pad(m)}-${pad(d)}`
}

// Parte el cuerpo de un template en parámetros por `|` de primer nivel,
// respetando el anidamiento de wikilinks [[..|..]] y templates {{..|..}}.
function splitParams(body) {
  const parts = []
  let depthB = 0
  let depthC = 0
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    const nx = body[i + 1]
    if (ch === '[' && nx === '[') {
      depthB++
      cur += '[['
      i++
    } else if (ch === ']' && nx === ']') {
      depthB--
      cur += ']]'
      i++
    } else if (ch === '{' && nx === '{') {
      depthC++
      cur += '{{'
      i++
    } else if (ch === '}' && nx === '}') {
      depthC--
      cur += '}}'
      i++
    } else if (ch === '|' && depthB === 0 && depthC === 0) {
      parts.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  parts.push(cur)
  return parts
}

function parsePlayerRow(line) {
  const head = line.match(/\{\{\s*(?:nat fs [a-z ]*player|National football squad player)\s*\|/i)
  if (!head) return null
  const body = line.slice(head.index + head[0].length).replace(/\}\}\s*$/, '')
  const map = {}
  for (const part of splitParams(body)) {
    const eq = part.indexOf('=')
    if (eq > 0) map[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim()
  }
  const name = unlink(map.name)
  if (!name) return null
  const num = (v) => (v != null && v.trim() !== '' ? Number(v.replace(/[^\d]/g, '')) : null)
  return {
    no: map.no ? Number(map.no.trim()) || null : null,
    pos: map.pos ? map.pos.trim().toUpperCase() : null,
    name,
    dob: extractDob(map.age || ''),
    caps: num(map.caps),
    goals: map.goals != null && map.goals.trim() !== '' ? num(map.goals) || 0 : null,
    club: unlink(map.club) || null,
  }
}

// Devuelve el bloque de wikitext de la sección del campeón (hasta el próximo
// encabezado del mismo o mayor nivel).
function championSection(text, champion) {
  const esc = escapeRe(champion)
  for (const level of ['===', '==']) {
    const re = new RegExp('^' + level + '\\s*' + esc + '\\s*' + level + '\\s*$', 'm')
    const m = re.exec(text)
    if (m) {
      const start = m.index + m[0].length
      const rest = text.slice(start)
      // Próximo encabezado (nivel 2 o 3) marca el fin de la sección del equipo.
      const nextRe = /\n===?[^=]/
      const next = rest.search(nextRe)
      return next >= 0 ? rest.slice(0, next) : rest
    }
  }
  return null
}

async function scrapeEdition(edition) {
  const title = `${edition.year}_FIFA_World_Cup_squads`
  const url = `https://en.wikipedia.org/wiki/${title}?action=raw`
  let squad = []
  let coach = null
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'wc-calendar-academy/1.0 (github pages dataset)' } })
    if (res.ok) {
      const text = await res.text()
      const section = championSection(text, edition.champion)
      if (section) {
        const coachMatch = section.match(/(?:Head coach|Coach|Manager):\s*(.+)/)
        if (coachMatch) coach = unlink(coachMatch[1].split('<ref')[0]) || null
        const lines = section
          .split('\n')
          .filter((l) => /\{\{\s*(?:nat fs [a-z ]*player|National football squad player)/i.test(l))
        squad = lines.map(parsePlayerRow).filter(Boolean)
      }
    } else {
      console.warn(`  ! ${edition.year}: HTTP ${res.status}`)
    }
  } catch (err) {
    console.warn(`  ! ${edition.year}: ${err.message}`)
  }
  return { ...edition, coach, squad }
}

async function main() {
  console.log('Scraping World Cup champion squads from Wikipedia...')
  const editions = []
  for (const edition of EDITIONS) {
    const result = await scrapeEdition(edition)
    console.log(`  ${result.year} ${result.champion.padEnd(14)} -> ${result.squad.length} jugadores${result.coach ? ' (DT: ' + result.coach + ')' : ''}`)
    editions.push(result)
  }

  const withData = editions.filter((e) => e.squad.length > 0).length
  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'Wikipedia — "{year} FIFA World Cup squads"',
    editions,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`\nEscrito ${OUTPUT_PATH}`)
  console.log(`Ediciones con plantilla: ${withData}/${editions.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
