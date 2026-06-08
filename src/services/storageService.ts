const FAVORITES_KEY = 'wc26:favorites'
const FAVORITE_SELECTIONS_KEY = 'wc26:favorite-selections'

export interface FavoriteSelection {
  id: string
  name: string
  favorites: string[]
  updatedAt: string
}

export function readFavoriteIds(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

export function writeFavoriteIds(ids: string[]): void {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
}

export function readFavoriteSelections(): FavoriteSelection[] {
  try {
    const raw = window.localStorage.getItem(FAVORITE_SELECTIONS_KEY)
    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is FavoriteSelection => {
        if (!item || typeof item !== 'object') {
          return false
        }

        const candidate = item as Partial<FavoriteSelection>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.name === 'string' &&
          typeof candidate.updatedAt === 'string' &&
          Array.isArray(candidate.favorites)
        )
      })
      .map((selection) => ({
        ...selection,
        favorites: selection.favorites.filter(
          (entry): entry is string => typeof entry === 'string',
        ),
      }))
  } catch {
    return []
  }
}

export function writeFavoriteSelections(selections: FavoriteSelection[]): void {
  window.localStorage.setItem(FAVORITE_SELECTIONS_KEY, JSON.stringify(selections))
}
