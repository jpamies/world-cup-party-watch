const SHARE_VERSION = 1

export interface SharedFavoritesSelection {
  version: number
  name: string
  favorites: string[]
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded + '='.repeat((4 - (padded.length % 4 || 4)) % 4)
  const binary = atob(withPadding)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSelection(selection: {
  name: string
  favorites: string[]
}): string {
  const payload: SharedFavoritesSelection = {
    version: SHARE_VERSION,
    name: selection.name.trim() || 'Mis Favoritos',
    favorites: [...new Set(selection.favorites)].sort((a, b) => a.localeCompare(b)),
  }

  return toBase64Url(JSON.stringify(payload))
}

export function decodeSelection(value: string): SharedFavoritesSelection | null {
  try {
    const raw = fromBase64Url(value)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const candidate = parsed as Partial<SharedFavoritesSelection>
    if (
      candidate.version !== SHARE_VERSION ||
      typeof candidate.name !== 'string' ||
      !Array.isArray(candidate.favorites)
    ) {
      return null
    }

    const favorites = candidate.favorites.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    )

    return {
      version: SHARE_VERSION,
      name: candidate.name.trim() || 'Favoritos Compartidos',
      favorites: [...new Set(favorites)].sort((a, b) => a.localeCompare(b)),
    }
  } catch {
    return null
  }
}
