// Añade (de forma quirúrgica) la edición 2026 —España campeona— a
// public/academy/data/champions.json sin re-scrapear ni tocar las 22 ediciones
// previas ni sus canteras ya scrapeadas.
//
// Fuente: Wikipedia "2026 FIFA World Cup squads" (sección ===Spain===) para la
// plantilla, y la ficha de cada jugador para la cantera (youthclubs).
//
// Uso: node scripts/academy/add-edition-2026.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = resolve(__dirname, '..', '..', 'public', 'academy', 'data', 'champions.json')

const EDITION_2026 = {
  year: 2026,
  host: 'Canada / Mexico / United States',
  champion: 'Spain',
  iso2: 'es',
  runnerUp: 'Argentina',
  score: '1–0',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- Parsing de wikitext (compartido con scrape-champions / scrape-youth) ----

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wikiTitle(value) {
  if (!value) return null
  const m = value.match(/\[\[([^\]|]+)/)
  return m ? m[1].trim() : null
}

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
    wiki: wikiTitle(map.name),
    dob: extractDob(map.age || ''),
    caps: num(map.caps),
    goals: map.goals != null && map.goals.trim() !== '' ? num(map.goals) || 0 : null,
    club: unlink(map.club) || null,
  }
}

function championSection(text, champion) {
  const esc = escapeRe(champion)
  for (const level of ['===', '==']) {
    const re = new RegExp('^' + level + '\\s*' + esc + '\\s*' + level + '\\s*$', 'm')
    const m = re.exec(text)
    if (m) {
      const start = m.index + m[0].length
      const rest = text.slice(start)
      const nextRe = /\n===?[^=]/
      const next = rest.search(nextRe)
      return next >= 0 ? rest.slice(0, next) : rest
    }
  }
  return null
}

function parseYouth(text) {
  const youth = []
  for (let i = 1; i <= 20; i++) {
    const clubM = text.match(new RegExp('\\|\\s*youthclubs' + i + '\\s*=\\s*([^\\n]*)', 'i'))
    if (!clubM) continue
    const raw = clubM[1]
    if (!raw || !raw.trim()) continue
    const parts = raw.split(/<br\s*\/?>/i)
    const yearsM = text.match(new RegExp('\\|\\s*youthyears' + i + '\\s*=\\s*([^\\n]*)', 'i'))
    const yearsRaw = yearsM ? unlink(yearsM[1]) : null
    const years = yearsRaw && /\d/.test(yearsRaw) ? yearsRaw : null
    for (const part of parts) {
      const club = unlink(part).split('|')[0].trim()
      if (club && club.length > 1 && !/[={}[\]]/.test(club)) {
        youth.push({ club, years: years || null })
      }
    }
  }
  return youth
}

async function fetchRaw(title, depth = 0) {
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}?action=raw`
  for (let attempt = 0; attempt < 5; attempt++) {
    let res
    try {
      res = await fetch(url, { headers: { 'User-Agent': 'wc-calendar-academy/1.0 (github pages dataset)' } })
    } catch {
      await sleep(500 * (attempt + 1))
      continue
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(800 * (attempt + 1))
      continue
    }
    if (res.status === 404) return { status: 'missing' }
    if (!res.ok) return { status: 'error' }
    const text = await res.text()
    const redir = text.match(/^\s*#REDIRECT\s*\[\[([^\]|#]+)/i)
    if (redir && depth < 2) return fetchRaw(redir[1].trim(), depth + 1)
    return { status: 'ok', text }
  }
  return { status: 'error' }
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'))
  if (data.editions.some((e) => e.year === 2026)) {
    console.log('2026 ya presente; nada que hacer.')
    return
  }

  // 1) Plantilla de España 2026.
  const url = 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads?action=raw'
  const res = await fetch(url, { headers: { 'User-Agent': 'wc-calendar-academy/1.0 (github pages dataset)' } })
  if (!res.ok) throw new Error(`squads 2026 HTTP ${res.status}`)
  const text = await res.text()
  const section = championSection(text, EDITION_2026.champion)
  if (!section) throw new Error('No se encontró la sección de España en 2026')

  const coachMatch = section.match(/(?:Head coach|Coach|Manager):\s*(.+)/)
  const coach = coachMatch ? unlink(coachMatch[1].split('<ref')[0]) || null : null
  const squad = section
    .split('\n')
    .filter((l) => /\{\{\s*(?:nat fs [a-z ]*player|National football squad player)/i.test(l))
    .map(parsePlayerRow)
    .filter(Boolean)

  console.log(`España 2026: ${squad.length} jugadores (DT: ${coach ?? '—'})`)

  // 2) Cantera de cada jugador (secuencial, respetuoso con Wikipedia).
  let withYouth = 0
  for (const p of squad) {
    p.youth = []
    if (!p.wiki) continue
    const r = await fetchRaw(p.wiki)
    if (r.status === 'ok') {
      p.youth = parseYouth(r.text)
      if (p.youth.length) withYouth++
    }
    process.stdout.write(`  ${p.name}: ${p.youth.map((y) => y.club).join(', ') || '—'}\n`)
    await sleep(150)
  }
  console.log(`Canteras encontradas: ${withYouth}/${squad.length}`)

  // 3) Inserta la edición y reescribe (manteniendo orden cronológico).
  const edition = { ...EDITION_2026, coach, squad }
  data.editions.push(edition)
  data.editions.sort((a, b) => a.year - b.year)
  data.generatedAt = new Date().toISOString()
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`Escrito ${DATA_PATH} (${data.editions.length} ediciones)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
