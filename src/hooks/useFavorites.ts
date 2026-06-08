import { useMemo, useState } from 'react'
import {
  readFavoriteIds,
  readFavoriteSelections,
  writeFavoriteIds,
  writeFavoriteSelections,
  type FavoriteSelection,
} from '../services/storageService'

interface SaveSelectionResult {
  status: 'saved' | 'overwritten' | 'requires-confirmation' | 'missing-name'
  selection: FavoriteSelection | null
}

function normalizeSelectionName(name: string): string {
  return name.trim().toLowerCase()
}

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

  const saveSelection = (
    name: string,
    options?: { overwriteByName?: boolean },
  ): SaveSelectionResult => {
    const normalizedName = name.trim()
    if (!normalizedName) {
      return { status: 'missing-name', selection: null }
    }

    const now = new Date().toISOString()
    const existing = savedSelections.find(
      (item) => normalizeSelectionName(item.name) === normalizeSelectionName(normalizedName),
    )

    if (existing && !options?.overwriteByName) {
      return { status: 'requires-confirmation', selection: existing }
    }

    if (existing) {
      const overwritten: FavoriteSelection = {
        ...existing,
        name: normalizedName,
        favorites: sortedIds,
        updatedAt: now,
      }

      const next = savedSelections.map((item) =>
        item.id === existing.id ? overwritten : item,
      )

      setSavedSelections(next)
      writeFavoriteSelections(next)
      return { status: 'overwritten', selection: overwritten }
    }

    const newSelection: FavoriteSelection = {
      id: `sel-${Date.now().toString(36)}`,
      name: normalizedName,
      favorites: sortedIds,
      updatedAt: now,
    }

    const next = [newSelection, ...savedSelections]
    setSavedSelections(next)
    writeFavoriteSelections(next)
    return { status: 'saved', selection: newSelection }
  }

  const loadSelection = (selectionId: string): FavoriteSelection | null => {
    const selection = savedSelections.find((item) => item.id === selectionId)
    if (!selection) {
      return null
    }

    replaceFavorites(selection.favorites)
    return selection
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
