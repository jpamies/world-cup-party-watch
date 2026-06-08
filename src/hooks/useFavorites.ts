import { useMemo, useState } from 'react'
import { readFavoriteIds, writeFavoriteIds } from '../services/storageService'

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(readFavoriteIds()),
  )

  const sortedIds = useMemo(
    () => [...favoriteIds].sort((left, right) => left.localeCompare(right)),
    [favoriteIds],
  )

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      writeFavoriteIds([...next])
      return next
    })
  }

  return {
    favoriteIds,
    favoriteCount: favoriteIds.size,
    favoriteList: sortedIds,
    toggleFavorite,
  }
}
