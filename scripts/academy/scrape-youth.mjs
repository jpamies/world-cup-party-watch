// Enriquece public/academy/data/champions.json con la cantera (equipos
// juveniles) de cada jugador, leyendo la sección "Youth career" del infobox
// de su ficha de Wikipedia (campos youthclubsN / youthyearsN).
//
// Requiere que champions.json ya tenga el campo `wiki` por jugador
// (lo genera scrape-champions.mjs). Uso: node scripts/academy/scrape-youth.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = resolve(__dirname, '..', '..', 'public', 'academy', 'data', 'champions.json')
const CONCURRENCY = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<ref.*?<\/ref>/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/''+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extrae la cantera desde el wikitext del infobox: youthclubs1..N + youthyears1..N.
function parseYouth(text) {
  const youth = []
  for (let i = 1; i <= 20; i++) {
    const clubM = text.match(new RegExp('\\|\\s*youthclubs' + i + '\\s*=\\s*([^\\n]*)', 'i'))
    if (!clubM) continue
    const raw = clubM[1]
    if (!raw || !raw.trim()) continue
    // Un campo puede listar varios clubs separados por <br>.
    const parts = raw.split(/<br\s*\/?>/i)
    const yearsM = text.match(new RegExp('\\|\\s*youthyears' + i + '\\s*=\\s*([^\\n]*)', 'i'))
    const yearsRaw = yearsM ? unlink(yearsM[1]) : null
    const years = yearsRaw && /\d/.test(yearsRaw) ? yearsRaw : null
    for (const part of parts) {
      // unlink resuelve el wikilink primero; luego descartamos campos inline
      // (p. ej. "[[Club]] | youthyears1 = 1982") quedándonos con el tramo previo al "|".
      const club = unlink(part).split('|')[0].trim()
      // Descarta residuos de parseo (fragmentos de wikitext, no clubes reales).
      if (club && club.length > 1 && !/[={}[\]]/.test(club)) {
        youth.push({ club, years: years || null })
      }
    }
  }
  return youth
}

// Descarga el wikitext siguiendo redirects, con reintentos ante 429/5xx.
// Devuelve { status: 'ok'|'missing'|'error', text }.
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

// Devuelve { status, youth }. 'ok' trae array (posible vacío = sin cantera real),
// 'missing' = página inexistente, 'error' = fallo transitorio (no pisar datos).
async function fetchYouth(title) {
  const r = await fetchRaw(title)
  if (r.status === 'ok') return { status: 'ok', youth: parseYouth(r.text) }
  return { status: r.status, youth: null }
}

// Ejecuta tareas con límite de concurrencia.
async function mapPool(items, limit, worker) {
  const results = new Array(items.length)
  let idx = 0
  async function run() {
    while (idx < items.length) {
      const cur = idx++
      results[cur] = await worker(items[cur], cur)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'))

  // Títulos únicos de Wikipedia (un jugador puede aparecer en varias ediciones).
  const titles = new Set()
  for (const edition of data.editions) {
    for (const p of edition.squad) {
      if (p.wiki) titles.add(p.wiki)
    }
  }
  const titleList = [...titles]
  console.log(`Buscando canteras de ${titleList.length} jugadores únicos...`)

  // Cantera previa por título (para preservar ante fallos transitorios).
  const prevYouth = new Map()
  for (const edition of data.editions) {
    for (const p of edition.squad) {
      if (p.wiki && Array.isArray(p.youth) && p.youth.length) prevYouth.set(p.wiki, p.youth)
    }
  }

  let done = 0
  const cache = new Map()
  await mapPool(titleList, CONCURRENCY, async (title) => {
    cache.set(title, await fetchYouth(title))
    done++
    if (done % 50 === 0) console.log(`  ${done}/${titleList.length}`)
  })

  // Reintenta en bucle los que dieron error transitorio, hasta agotar o sin avance.
  for (let pass = 1; pass <= 4; pass++) {
    const failed = titleList.filter((t) => cache.get(t).status === 'error')
    if (!failed.length) break
    console.log(`Reintento ${pass}: ${failed.length} fichas con error...`)
    for (const title of failed) {
      cache.set(title, await fetchYouth(title))
      await sleep(200)
    }
  }

  // Vuelca la cantera en cada jugador. Ante error transitorio conserva la previa.
  let withYouth = 0
  let total = 0
  for (const edition of data.editions) {
    for (const p of edition.squad) {
      total++
      if (!p.wiki) {
        p.youth = []
      } else {
        const r = cache.get(p.wiki)
        if (r.status === 'ok') p.youth = r.youth
        else if (r.status === 'missing') p.youth = []
        else p.youth = prevYouth.get(p.wiki) || p.youth || [] // error: preserva
      }
      if (p.youth.length) withYouth++
    }
  }

  data.youthScrapedAt = new Date().toISOString()
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`\nActualizado ${DATA_PATH}`)
  console.log(`Jugadores con cantera: ${withYouth}/${total}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
