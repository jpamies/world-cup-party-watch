const FAVORITES_KEY = 'wc26:favorites'

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
