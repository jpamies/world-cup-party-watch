import { NavLink } from 'react-router-dom'

const ACADEMY_URL = `${import.meta.env.BASE_URL}academy/`

export function TopNav() {
  return (
    <nav className="main-nav" aria-label="Navegacion principal">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          isActive ? 'nav-pill nav-pill-active' : 'nav-pill'
        }
      >
        Tablero
      </NavLink>
      <NavLink
        to="/calendario"
        className={({ isActive }) =>
          isActive ? 'nav-pill nav-pill-active' : 'nav-pill'
        }
      >
        Calendario
      </NavLink>
      <NavLink
        to="/favorites"
        className={({ isActive }) =>
          isActive ? 'nav-pill nav-pill-active' : 'nav-pill'
        }
      >
        Favoritos
      </NavLink>
      <a className="nav-pill" href={ACADEMY_URL}>
        Canteras
      </a>
    </nav>
  )
}
