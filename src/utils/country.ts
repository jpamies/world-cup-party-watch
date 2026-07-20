function normalizeCountryName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase()
}

const COUNTRY_ISO2_MAP: Record<string, string> = {
  algeria: 'DZ',
  argentina: 'AR',
  australia: 'AU',
  austria: 'AT',
  belgium: 'BE',
  bosniaherzegovina: 'BA',
  brazil: 'BR',
  caboverde: 'CV',
  canada: 'CA',
  colombia: 'CO',
  congodr: 'CD',
  croatia: 'HR',
  curacao: 'CW',
  czechia: 'CZ',
  cotedivoire: 'CI',
  ecuador: 'EC',
  egypt: 'EG',
  england: 'GB',
  france: 'FR',
  germany: 'DE',
  ghana: 'GH',
  haiti: 'HT',
  iriran: 'IR',
  iraq: 'IQ',
  japan: 'JP',
  jordan: 'JO',
  korearepublic: 'KR',
  mexico: 'MX',
  morocco: 'MA',
  netherlands: 'NL',
  newzealand: 'NZ',
  norway: 'NO',
  panama: 'PA',
  paraguay: 'PY',
  portugal: 'PT',
  qatar: 'QA',
  saudiarabia: 'SA',
  scotland: 'GB',
  senegal: 'SN',
  southafrica: 'ZA',
  spain: 'ES',
  sweden: 'SE',
  switzerland: 'CH',
  tunisia: 'TN',
  turkiye: 'TR',
  usa: 'US',
  uruguay: 'UY',
  uzbekistan: 'UZ',
}

function isoToFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('')
}

export function getCountryFlagEmoji(name: string): string | null {
  const code = COUNTRY_ISO2_MAP[normalizeCountryName(name)]
  if (!code) {
    return null
  }

  return isoToFlagEmoji(code)
}

export function getCountryFlagCode(name: string): string | null {
  return COUNTRY_ISO2_MAP[normalizeCountryName(name)] ?? null
}

export function getCountryFlagSrc(name: string): string | null {
  const normalized = normalizeCountryName(name)

  if (normalized === 'england') {
    return `${import.meta.env.BASE_URL}flags/england.svg`
  }

  if (normalized === 'scotland') {
    return `${import.meta.env.BASE_URL}flags/scotland.svg`
  }

  const code = COUNTRY_ISO2_MAP[normalized]
  if (!code) {
    return null
  }

  return `${import.meta.env.BASE_URL}flags/${code.toLowerCase()}.png`
}

export function getCountryShortToken(name: string): string {
  const token = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()

  return token.length > 0 ? token : '---'
}
