import { useMemo } from 'react'
import { getLocalTimeZone } from '../utils/date'

export function useTimezone(): string {
  return useMemo(() => getLocalTimeZone(), [])
}
