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
    let liveApplied = false

    getCalendarMatches((liveMatches) => {
      // Actualización en vivo (API FIFA / localStorage) sobre la base ya mostrada.
      if (!mounted) {
        return
      }

      liveApplied = true
      setState({
        matches: liveMatches,
        isLoading: false,
        error: null,
      })
    })
      .then((baseMatches) => {
        // Base inmediata desde el snapshot estático. No pisa el vivo si ya llegó.
        if (!mounted || liveApplied) {
          return
        }

        setState({
          matches: baseMatches,
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
