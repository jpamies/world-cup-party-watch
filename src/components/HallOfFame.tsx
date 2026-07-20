import { useEffect, useState } from 'react'
import { loadHallOfFame, type HallOfFame as HallOfFameData } from '../services/hallOfFameService'

const ACADEMY_CANTERAS_URL = `${import.meta.env.BASE_URL}academy/index.html#/canteras`
const TOP = 8

function flagSrc(iso2: string): string {
  return `${import.meta.env.BASE_URL}academy/flags/${iso2}.png`
}

export function HallOfFame() {
  const [data, setData] = useState<HallOfFameData | null>(null)

  useEffect(() => {
    let alive = true
    void loadHallOfFame().then((result) => {
      if (alive) setData(result)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!data || (data.players.length === 0 && data.clubs.length === 0)) {
    return null
  }

  const players = data.players.slice(0, TOP)
  const clubs = data.clubs.slice(0, TOP)
  const academies = data.academies.slice(0, TOP)

  return (
    <div className="hof">
      <section className="hof-group" aria-label="Récords de jugadores">
        <h3 className="hof-group-title">Jugadores</h3>
        <p className="hof-col-caption">Más Mundiales ganados</p>
        <ol className="hof-list">
          {players.map((player, index) => (
            <li className="hof-row" key={player.name + player.years[0]}>
              <span className="hof-rank">{index + 1}</span>
              <img className="hof-flag" src={flagSrc(player.iso2)} alt="" aria-hidden="true" />
              <span className="hof-name">{player.name}</span>
              <span className="hof-years">{player.years.join(' · ')}</span>
              <span className="hof-count">{player.titles}×</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="hof-group" aria-label="Récords de clubes">
        <h3 className="hof-group-title">Clubes</h3>
        <div className="hof-cols">
          <div className="hof-col">
            <p className="hof-col-caption">Club con más campeones</p>
            <ol className="hof-list">
              {clubs.map((club, index) => (
                <li className="hof-row" key={club.name}>
                  <span className="hof-rank">{index + 1}</span>
                  <span className="hof-name">{club.name}</span>
                  <span className="hof-count">{club.count}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="hof-col">
            <a className="hof-col-caption hof-col-link" href={ACADEMY_CANTERAS_URL}>
              Cantera con más campeones <span aria-hidden="true">→</span>
            </a>
            <ol className="hof-list">
              {academies.map((academy, index) => (
                <li className="hof-row" key={academy.name}>
                  <a className="hof-row-link" href={ACADEMY_CANTERAS_URL}>
                    <span className="hof-rank">{index + 1}</span>
                    <span className="hof-name">{academy.name}</span>
                    <span className="hof-count">{academy.count}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  )
}
