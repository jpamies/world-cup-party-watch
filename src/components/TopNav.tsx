import { NavLink } from 'react-router-dom'

export function TopNav() {
  return (
    <nav className="main-nav" aria-label="Primary">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          isActive ? 'nav-pill nav-pill-active' : 'nav-pill'
        }
      >
        All Matches
      </NavLink>
      <NavLink
        to="/favorites"
        className={({ isActive }) =>
          isActive ? 'nav-pill nav-pill-active' : 'nav-pill'
        }
      >
        Favorites
      </NavLink>
    </nav>
  )
}
