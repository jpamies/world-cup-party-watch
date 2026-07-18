// Academy — campeones del Mundo. Sitio estático plano (sin framework).
// Consume ./data/champions.json generado por scripts/academy/scrape-champions.mjs.

const POSITIONS = [
  { key: 'GK', label: 'PORTEROS', match: (p) => p === 'GK' },
  { key: 'DF', label: 'DEFENSAS', match: (p) => p === 'DF' },
  { key: 'MF', label: 'CENTROCAMPISTAS', match: (p) => p === 'MF' },
  { key: 'FW', label: 'DELANTEROS', match: (p) => p === 'FW' },
]

const app = document.getElementById('app')
const foot = document.getElementById('foot')
const tabs = document.getElementById('tabs')

let DATA = null

function flagUrl(iso2) {
  return `https://flagcdn.com/w80/${iso2}.png`
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function formatDob(dob) {
  if (!dob) return '—'
  const [y, m, d] = dob.split('-')
  return `${d}/${m}/${y}`
}

function ageAt(dob, year) {
  if (!dob) return null
  const by = Number(dob.slice(0, 4))
  return year - by
}

function setActiveTab(tab) {
  tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === tab))
}

// ---------- Vistas ----------
function renderHome() {
  setActiveTab('home')
  const editions = [...DATA.editions].sort((a, b) => b.year - a.year)
  app.innerHTML = `
    <div class="editions-grid">
      ${editions
        .map(
          (e) => `
        <a class="edition-card" href="#/edition/${e.year}">
          <img src="${flagUrl(e.iso2)}" alt="${escapeHtml(e.champion)}" loading="lazy" />
          <span>
            <span class="edition-year">${e.year}</span><br />
            <span class="edition-champ">${escapeHtml(e.champion)}</span><br />
            <span class="edition-meta">${escapeHtml(e.score)} vs ${escapeHtml(e.runnerUp)}</span>
          </span>
        </a>`
        )
        .join('')}
    </div>`
}

function renderEdition(year) {
  const e = DATA.editions.find((x) => x.year === Number(year))
  if (!e) {
    renderHome()
    return
  }
  setActiveTab('home')
  const groups = POSITIONS.map((g) => ({ ...g, players: e.squad.filter((p) => g.match(p.pos)) }))
  const ungrouped = e.squad.filter((p) => !POSITIONS.some((g) => g.match(p.pos)))
  if (ungrouped.length) groups.push({ key: 'OTHER', label: 'OTROS', players: ungrouped })

  const rows = (players) =>
    players
      .map((p) => {
        const age = ageAt(p.dob, e.year)
        return `
        <tr>
          <td class="num">${p.no ?? ''}</td>
          <td class="name">${escapeHtml(p.name)}</td>
          <td class="club">${escapeHtml(p.club ?? '—')}</td>
          <td class="stat">${formatDob(p.dob)}${age != null ? ` (${age})` : ''}</td>
          <td class="stat">${p.caps ?? '—'}</td>
          <td class="stat">${p.goals ?? '—'}</td>
        </tr>`
      })
      .join('')

  app.innerHTML = `
    <div class="detail-head">
      <img src="${flagUrl(e.iso2)}" alt="${escapeHtml(e.champion)}" />
      <div class="detail-title">
        <span class="y">${e.year}</span>
        <span class="c">${escapeHtml(e.champion)}</span>
        <span class="m">Sede: ${escapeHtml(e.host)} · Final ${escapeHtml(e.score)} vs ${escapeHtml(e.runnerUp)}${
          e.coach ? ` · DT: ${escapeHtml(e.coach)}` : ''
        }</span>
      </div>
      <a class="back-link" href="#/">← VOLVER</a>
    </div>
    ${groups
      .filter((g) => g.players.length)
      .map(
        (g) => `
      <section class="pos-group">
        <h3>${g.label} (${g.players.length})</h3>
        <table class="squad-table">
          <thead>
            <tr><th>#</th><th>Jugador</th><th class="club">Club</th><th>Nacimiento</th><th>Int.</th><th>Goles</th></tr>
          </thead>
          <tbody>${rows(g.players)}</tbody>
        </table>
      </section>`
      )
      .join('')}`
}

function renderClubs() {
  setActiveTab('clubs')
  const counts = new Map()
  for (const e of DATA.editions) {
    for (const p of e.squad) {
      if (!p.club) continue
      const entry = counts.get(p.club) ?? { club: p.club, total: 0, years: new Set() }
      entry.total += 1
      entry.years.add(e.year)
      counts.set(p.club, entry)
    }
  }
  const ranked = [...counts.values()].sort((a, b) => b.total - a.total || a.club.localeCompare(b.club)).slice(0, 40)

  app.innerHTML = `
    <p class="rank-intro">
      Clubes que más jugadores campeones del mundo han aportado (club en el momento de cada torneo).
      La cantera de origen de cada jugador llegará en la siguiente iteración.
    </p>
    <table class="rank-table">
      <thead><tr><th>#</th><th>Club</th><th>Campeones</th><th>Mundiales</th></tr></thead>
      <tbody>
        ${ranked
          .map(
            (r, i) => `
          <tr>
            <td class="pos">${i + 1}</td>
            <td>${escapeHtml(r.club)}</td>
            <td class="count">${r.total}</td>
            <td>${[...r.years].sort().join(', ')}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`
}

// ---------- Router ----------
function route() {
  const hash = location.hash || '#/'
  const editionMatch = hash.match(/^#\/edition\/(\d+)/)
  if (editionMatch) return renderEdition(editionMatch[1])
  if (hash.startsWith('#/clubs')) return renderClubs()
  return renderHome()
}

async function boot() {
  try {
    const res = await fetch('./data/champions.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    DATA = await res.json()
  } catch (err) {
    app.innerHTML = `<p class="board-loading">No se pudieron cargar los datos (${escapeHtml(err.message)}).</p>`
    return
  }

  const totalPlayers = DATA.editions.reduce((n, e) => n + e.squad.length, 0)
  document.getElementById('brand-number').textContent = DATA.editions.length
  foot.innerHTML = `
    <span>${DATA.editions.length} ediciones · ${totalPlayers} jugadores campeones</span>
    <span>Fuente: ${escapeHtml(DATA.source)}</span>`

  window.addEventListener('hashchange', route)
  route()
}

boot()
