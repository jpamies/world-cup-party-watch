// Descarga las imágenes del "Hall of Fame" del Mundial (top 3):
//   - Fotos de los jugadores con más títulos   -> public/academy/players/{slug}.png
//   - Escudos de los clubes y canteras top      -> public/academy/crests/{slug}.png
//
// Las imágenes se guardan localmente para mantener el sitio 100% offline.
// El script recalcula el top 3 desde champions.json, así que solo hay que
// re-ejecutarlo si cambian los datos. Re-ejecutable: salta ficheros existentes.
//
// Uso: node scripts/academy/build-hof-assets.mjs
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..', 'public', 'academy')
const DATA_PATH = resolve(ROOT, 'data', 'champions.json')
const PLAYERS_DIR = resolve(ROOT, 'players')
const CRESTS_DIR = resolve(ROOT, 'crests')

const TOP = 3
const UA = { 'User-Agent': 'wc-calendar-academy/1.0 (github pages dataset)' }

// Nombre en champions.json -> título del artículo de Wikipedia (para desambiguar).
const WIKI_TITLE = {
  Barcelona: 'FC Barcelona',
  'Bayern Munich': 'FC Bayern Munich',
  Juventus: 'Juventus FC',
  'River Plate': 'Club Atlético River Plate',
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

// Resuelve la miniatura (thumbnail) del artículo de Wikipedia.
async function wikiThumb(title, size) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=${size}&titles=${encodeURIComponent(title)}`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`api ${res.status} for ${title}`)
  const data = await res.json()
  const pages = data?.query?.pages ?? {}
  for (const page of Object.values(pages)) {
    const src = page?.thumbnail?.source
    if (src) return src
  }
  return null
}

async function download(url, dest) {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`img ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
}

async function fetchInto(name, title, dir, size) {
  const slug = slugify(name)
  const dest = resolve(dir, `${slug}.png`)
  if (await exists(dest)) {
    console.log(`  = ${name} (ya existe)`) 
    return
  }
  const thumb = await wikiThumb(title, size)
  if (!thumb) {
    console.log(`  ! ${name}: sin imagen en Wikipedia (${title})`)
    return
  }
  await download(thumb, dest)
  console.log(`  + ${name} -> ${slug}.png`)
}

function computeTops(editions) {
  const players = new Map()
  const clubs = new Map()
  const academies = new Map()
  for (const edition of editions) {
    for (const p of edition.squad) {
      const key = p.wiki ?? p.name
      const entry = players.get(key) ?? { name: p.name, wiki: key, titles: 0 }
      entry.titles++
      players.set(key, entry)
      if (p.club) clubs.set(p.club, (clubs.get(p.club) ?? 0) + 1)
      for (const y of p.youth ?? []) academies.set(y.club, (academies.get(y.club) ?? 0) + 1)
    }
  }
  const topPlayers = [...players.values()]
    .filter((p) => p.titles > 1)
    .sort((a, b) => b.titles - a.titles)
    .slice(0, TOP)
  const rank = (m) =>
    [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, TOP)
  return { players: topPlayers, clubs: rank(clubs), academies: rank(academies) }
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'))
  const tops = computeTops(data.editions ?? [])

  await mkdir(PLAYERS_DIR, { recursive: true })
  await mkdir(CRESTS_DIR, { recursive: true })

  console.log('Jugadores:')
  for (const p of tops.players) {
    await fetchInto(p.wiki, WIKI_TITLE[p.wiki] ?? p.wiki, PLAYERS_DIR, 240)
  }

  const teams = new Map()
  for (const t of [...tops.clubs, ...tops.academies]) teams.set(t.name, true)
  console.log('Escudos:')
  for (const name of teams.keys()) {
    await fetchInto(name, WIKI_TITLE[name] ?? name, CRESTS_DIR, 200)
  }

  console.log('Hecho.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
