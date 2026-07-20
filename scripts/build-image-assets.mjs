// Descarga a public/ todas las imágenes que la app referenciaba por CDN
// (banderas de país, banderas FIFA de árbitros/jugadores y fotos de jugadores)
// para que el sitio funcione 100% offline. Reescribe players-snapshot.json y
// public/academy/data para que apunten a rutas locales.
//
// Uso: node scripts/build-image-assets.mjs
// Reejecutable: salta las descargas cuyo fichero ya existe.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { constants as FS } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC = resolve(ROOT, 'public')

// Códigos ISO2 de país usados por src/utils/country.ts (getCountryFlagSrc, w40).
// England/Scotland ya tienen SVG local, no hacen falta aquí.
const COUNTRY_ISO2 = [
  'dz', 'ar', 'au', 'at', 'be', 'ba', 'br', 'cv', 'ca', 'co', 'cd', 'hr', 'cw',
  'cz', 'ci', 'ec', 'eg', 'fr', 'de', 'gh', 'ht', 'ir', 'iq', 'jp', 'jo', 'kr',
  'mx', 'ma', 'nl', 'nz', 'no', 'pa', 'py', 'pt', 'qa', 'sa', 'sn', 'za', 'es',
  'se', 'ch', 'tn', 'tr', 'us', 'uy', 'uz',
]

// Códigos iso2 usados por la academy (flagcdn w80). gb-eng incluido.
const ACADEMY_ISO2 = ['ar', 'br', 'de', 'es', 'fr', 'gb-eng', 'it', 'uy']

async function exists(path) {
  try {
    await access(path, FS.F_OK)
    return true
  } catch {
    return false
  }
}

async function download(url, dest, { force = false } = {}) {
  if (!force && (await exists(dest))) {
    return 'skip'
  }
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) {
    throw new Error(`empty ${url}`)
  }
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  return 'ok'
}

// Ejecuta tareas con concurrencia limitada; devuelve {ok, skip, fail}.
async function runPool(tasks, concurrency = 12) {
  const stats = { ok: 0, skip: 0, fail: 0 }
  let index = 0
  async function worker() {
    while (index < tasks.length) {
      const current = tasks[index++]
      try {
        const result = await current()
        stats[result] = (stats[result] ?? 0) + 1
      } catch (error) {
        stats.fail++
        console.warn('  ✗', error.message)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return stats
}

async function main() {
  // 1) Banderas de país (flagcdn w40) → public/flags/{iso2}.png
  console.log(`Banderas de país (${COUNTRY_ISO2.length})...`)
  const countryTasks = COUNTRY_ISO2.map((code) => () =>
    download(`https://flagcdn.com/w40/${code}.png`, resolve(PUBLIC, 'flags', `${code}.png`)),
  )
  console.log('  ', await runPool(countryTasks))

  // 2) Banderas FIFA de árbitros y jugadores (flags-sq-4) → public/flags/fifa/{code}.png
  const players = JSON.parse(await readFile(resolve(PUBLIC, 'data', 'players-snapshot.json'), 'utf8'))
  const results = JSON.parse(await readFile(resolve(PUBLIC, 'data', 'results-snapshot.json'), 'utf8'))
  const fifaCodes = new Set()
  for (const p of players.Players ?? []) {
    if (p.teamAbbr) fifaCodes.add(p.teamAbbr)
  }
  for (const m of results.Results ?? []) {
    for (const o of m.Officials ?? []) {
      if (o.IdCountry) fifaCodes.add(o.IdCountry)
    }
  }
  console.log(`Banderas FIFA (${fifaCodes.size})...`)
  const fifaTasks = [...fifaCodes].map((code) => () =>
    download(
      `https://api.fifa.com/api/v3/picture/flags-sq-4/${code}`,
      resolve(PUBLIC, 'flags', 'fifa', `${code}.png`),
    ),
  )
  console.log('  ', await runPool(fifaTasks))

  // 3) Fotos de jugadores (digitalhub) → public/img/players/{idPlayer}.png
  const photoPlayers = (players.Players ?? []).filter((p) => p.idPlayer && p.photo)
  console.log(`Fotos de jugadores (${photoPlayers.length})...`)
  const photoTasks = photoPlayers.map((p) => () => {
    const dest = resolve(PUBLIC, 'img', 'players', `${p.idPlayer}.png`)
    // Solo descarga si la url sigue siendo remota; si ya es local, salta.
    if (!/^https?:/i.test(p.photo)) return Promise.resolve('skip')
    return download(p.photo, dest)
  })
  console.log('  ', await runPool(photoTasks))

  // Reescribe el snapshot para apuntar a rutas locales (relativas, sin BASE_URL).
  let rewritten = 0
  for (const p of players.Players ?? []) {
    if (p.idPlayer && p.photo) {
      const local = `img/players/${p.idPlayer}.png`
      if (p.photo !== local) {
        p.photo = local
        rewritten++
      }
    }
  }
  await writeFile(
    resolve(PUBLIC, 'data', 'players-snapshot.json'),
    JSON.stringify(players, null, 2) + '\n',
  )
  console.log(`Snapshot reescrito: ${rewritten} fotos → rutas locales`)

  // 4) Banderas de la academy (flagcdn w80) → public/academy/flags/{iso2}.png
  console.log(`Banderas academy (${ACADEMY_ISO2.length})...`)
  const academyTasks = ACADEMY_ISO2.map((code) => () =>
    download(
      `https://flagcdn.com/w80/${code}.png`,
      resolve(PUBLIC, 'academy', 'flags', `${code}.png`),
    ),
  )
  console.log('  ', await runPool(academyTasks))

  console.log('Listo.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
