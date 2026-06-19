import { NavLink } from 'react-router-dom'

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
        to="/calendar"
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
    </nav>
  )
}
