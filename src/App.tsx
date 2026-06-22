import { Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ChannelLegend } from './components/ChannelLegend'
import { TopNav } from './components/TopNav'
import { useTheme } from './hooks/useTheme'
import CalendarPage from './pages/CalendarPage.tsx'
import FavoritesPage from './pages/FavoritesPage.tsx'
import TournamentBoardPage from './pages/TournamentBoardPage.tsx'

function AppContent() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const showBoardOnly = location.pathname === '/live'

  if (showBoardOnly) {
    return (
      <main className="board-wrap">
        <Suspense
          fallback={
            <div className="status-card" role="status" aria-live="polite">
              Cargando tablero...
            </div>
          }
        >
          <Routes>
            <Route path="/live" element={<TournamentBoardPage />} />
          </Routes>
        </Suspense>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero-banner">
        <button
          type="button"
          className="app-theme-toggle"
          onClick={toggleTheme}
          aria-pressed={theme === 'light'}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
        <p className="hero-kicker">FIFA World Cup 2026</p>
        <h1>World Cup Party Watch</h1>
        <p className="hero-subtitle">
          Elige los partidos que quieres ver, invita a tus amigos y mantén el ambiente durante todo el torneo.
        </p>
      </header>

      <TopNav />
      <ChannelLegend />

      <main className="content-wrap">
        <Suspense
          fallback={
            <div className="status-card" role="status" aria-live="polite">
              Cargando...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<CalendarPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/board" element={<Navigate to="/live" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}
