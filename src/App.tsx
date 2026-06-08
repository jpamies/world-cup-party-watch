import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TopNav } from './components/TopNav'

const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))

export function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <header className="hero-banner">
          <p className="hero-kicker">FIFA World Cup 2026</p>
          <h1>World Cup Party Watch</h1>
          <p className="hero-subtitle">
            Pick the matches you want to watch, invite your friends, and keep
            the vibes flowing all tournament long.
          </p>
        </header>

        <TopNav />

        <main className="content-wrap">
          <Suspense
            fallback={
              <div className="status-card" role="status" aria-live="polite">
                Loading calendar...
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<CalendarPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </HashRouter>
  )
}
