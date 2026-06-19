import { Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ChannelLegend } from './components/ChannelLegend'
import { TopNav } from './components/TopNav'
import CalendarPage from './pages/CalendarPage.tsx'
import FavoritesPage from './pages/FavoritesPage.tsx'
import TournamentBoardPage from './pages/TournamentBoardPage.tsx'

function AppContent() {
  const location = useLocation()
  const showBoardOnly = location.pathname === '/' || location.pathname === '/board'

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
            <Route path="/" element={<TournamentBoardPage />} />
            <Route path="/board" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero-banner">
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
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
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
