import { useMemo, useState } from 'react'
import {
  readFavoriteIds,
  readFavoriteSelections,
  writeFavoriteIds,
  writeFavoriteSelections,
  type FavoriteSelection,
} from '../services/storageService'

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(readFavoriteIds()),
  )
  const [savedSelections, setSavedSelections] = useState<FavoriteSelection[]>(
    () => readFavoriteSelections(),
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

  const replaceFavorites = (ids: string[]) => {
    const nextIds = [...new Set(ids)].sort((left, right) => left.localeCompare(right))
    setFavoriteIds(new Set(nextIds))
    writeFavoriteIds(nextIds)
  }

  const saveSelection = (name: string) => {
    const normalizedName = name.trim()
    if (!normalizedName) {
      return null
    }

    const newSelection: FavoriteSelection = {
      id: `sel-${Date.now().toString(36)}`,
      name: normalizedName,
      favorites: sortedIds,
      updatedAt: new Date().toISOString(),
    }

    const next = [newSelection, ...savedSelections]
    setSavedSelections(next)
    writeFavoriteSelections(next)
    return newSelection
  }

  const loadSelection = (selectionId: string) => {
    const selection = savedSelections.find((item) => item.id === selectionId)
    if (!selection) {
      return
    }

    replaceFavorites(selection.favorites)
  }

  const deleteSelection = (selectionId: string) => {
    const next = savedSelections.filter((item) => item.id !== selectionId)
    setSavedSelections(next)
    writeFavoriteSelections(next)
  }

  return {
    favoriteIds,
    favoriteCount: favoriteIds.size,
    favoriteList: sortedIds,
    savedSelections,
    toggleFavorite,
    replaceFavorites,
    saveSelection,
    loadSelection,
    deleteSelection,
  }
}
