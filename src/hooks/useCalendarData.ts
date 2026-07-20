import { useEffect, useState } from 'react'
import { getCalendarMatches } from '../services/calendarService'
import type { CalendarMatch } from '../types/calendar'

interface CalendarState {
  matches: CalendarMatch[]
  isLoading: boolean
  error: string | null
}

export function useCalendarData(): CalendarState {
  const [state, setState] = useState<CalendarState>({
    matches: [],
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let mounted = true

    getCalendarMatches()
      .then((matches) => {
        // Datos estáticos del snapshot empaquetado con la app.
        if (!mounted) {
          return
        }

        setState({
          matches,
          isLoading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unknown error'
        setState({
          matches: [],
          isLoading: false,
          error: message,
        })
      })

    return () => {
      mounted = false
    }
  }, [])

  return state
}
