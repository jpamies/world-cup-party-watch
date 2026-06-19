// Genera la tabla de asignación de los mejores terceros (Annex C del reglamento
// FIFA World Cup 2026) en formato CSV y JSON, listos para consumir por la app.
//
// Fuente: Wikipedia "2026 FIFA World Cup knockout stage" → sección
// "Combinations of matches in the round of 32" (495 filas del Annex C).
//
// La tabla original lista, para cada combinación de 8 grupos cuyos terceros
// clasifican, qué grupo juega en cada uno de los 8 partidos de dieciseisavos
// que incluyen un tercero. PERO las columnas de la tabla de Wikipedia NO van en
// orden de partido. El orden real de columnas (decodificado resolviendo las
// restricciones de grupos candidatos de cada partido) es:
//
//   col1→M79  col2→M85  col3→M81  col4→M74  col5→M82  col6→M77  col7→M87  col8→M80
//
// RAW[i] = string de 8 letras = los terceros asignados en ESE orden de columnas
// (col1..col8) para la combinación nº (i+1). Los 8 grupos clasificados se
// derivan del propio string (cada tercero clasificado se asigna exactamente a
// un partido).
//
// Ejecutar:  node scripts/build-third-place-allocation.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'data')

// Grupos candidatos de cada partido con tercero (para validar la transcripción).
const CANDIDATES = {
  74: 'ABCDF',
  77: 'CDFGH',
  79: 'CEFHI',
  80: 'EHIJK',
  81: 'BEFIJ',
  82: 'AEHIJ',
  85: 'EFGIJ',
  87: 'DEIJL',
}

// Orden de partidos en el CSV/JSON de salida.
const MATCH_ORDER = [74, 77, 79, 80, 81, 82, 85, 87]

// Índice (en el string RAW) de cada partido según el orden de columnas decodificado.
//   col1→79 col2→85 col3→81 col4→74 col5→82 col6→77 col7→87 col8→80
const MATCH_COL_INDEX = {
  79: 0,
  85: 1,
  81: 2,
  74: 3,
  82: 4,
  77: 5,
  87: 6,
  80: 7,
}

// 495 combinaciones (Annex C). String = terceros en orden de columna col1..col8.
const RAW = [
  'EJIFHGLK', 'HGIDJFLK', 'EJIDHGLK', 'EJIDHFLK', 'EGIDJFLK', 'EGJDHFLK',
  'EGIDHFLK', 'EGJDHFLI', 'EGJDHFIK', 'HGICJFLK', 'EJICHGLK', 'EJICHFLK',
  'EGICJFLK', 'EGJCHFLK', 'EGICHFLK', 'EGJCHFLI', 'EGJCHFIK', 'HGICJDLK',
  'CJIDHFLK', 'CGIDJFLK', 'CGJDHFLK', 'CGIDHFLK', 'CGJDHFLI', 'CGJDHFIK',
  'EJICHDLK', 'EGICJDLK', 'EGJCHDLK', 'EGICHDLK', 'EGJCHDLI', 'EGJCHDIK',
  'CJEDIFLK', 'CJEDHFLK', 'CEIDHFLK', 'CJEDHFLI', 'CJEDHFIK', 'CGEDJFLK',
  'CGEDIFLK', 'CGEDJFLI', 'CGEDJFIK', 'CGEDHFLK', 'CGJDHFLE', 'CGJDHFEK',
  'CGEDHFLI', 'CGEDHFIK', 'CGJDHFEI', 'HJBFIGLK', 'EJIBHGLK', 'EJBFIHLK',
  'EJBFIGLK', 'EJBFHGLK', 'EGBFIHLK', 'EJBFHGLI', 'EJBFHGIK', 'HJBDIGLK',
  'HJBDIFLK', 'IGBDJFLK', 'HGBDJFLK', 'HGBDIFLK', 'HGBDJFLI', 'HGBDJFIK',
  'EJBDIHLK', 'EJBDIGLK', 'EJBDHGLK', 'EGBDIHLK', 'EJBDHGLI', 'EJBDHGIK',
  'EJBDIFLK', 'EJBDHFLK', 'EIBDHFLK', 'EJBDHFLI', 'EJBDHFIK', 'EGBDJFLK',
  'EGBDIFLK', 'EGBDJFLI', 'EGBDJFIK', 'EGBDHFLK', 'HGBDJFLE', 'HGBDJFEK',
  'EGBDHFLI', 'EGBDHFIK', 'HGBDJFEI', 'HJBCIGLK', 'HJBCIFLK', 'IGBCJFLK',
  'HGBCJFLK', 'HGBCIFLK', 'HGBCJFLI', 'HGBCJFIK', 'EJBCIHLK', 'EJBCIGLK',
  'EJBCHGLK', 'EGBCIHLK', 'EJBCHGLI', 'EJBCHGIK', 'EJBCIFLK', 'EJBCHFLK',
  'EIBCHFLK', 'EJBCHFLI', 'EJBCHFIK', 'EGBCJFLK', 'EGBCIFLK', 'EGBCJFLI',
  'EGBCJFIK', 'EGBCHFLK', 'HGBCJFLE', 'HGBCJFEK', 'EGBCHFLI', 'EGBCHFIK',
  'HGBCJFEI', 'HJBCIDLK', 'IGBCJDLK', 'HGBCJDLK', 'HGBCIDLK', 'HGBCJDLI',
  'HGBCJDIK', 'CJBDIFLK', 'CJBDHFLK', 'CIBDHFLK', 'CJBDHFLI', 'CJBDHFIK',
  'CGBDJFLK', 'CGBDIFLK', 'CGBDJFLI', 'CGBDJFIK', 'CGBDHFLK', 'CGBDHFLJ',
  'HGBCJFDK', 'CGBDHFLI', 'CGBDHFIK', 'HGBCJFDI', 'EJBCIDLK', 'EJBCHDLK',
  'EIBCHDLK', 'EJBCHDLI', 'EJBCHDIK', 'EGBCJDLK', 'EGBCIDLK', 'EGBCJDLI',
  'EGBCJDIK', 'EGBCHDLK', 'HGBCJDLE', 'HGBCJDEK', 'EGBCHDLI', 'EGBCHDIK',
  'HGBCJDEI', 'CJBDEFLK', 'CEBDIFLK', 'CJBDEFLI', 'CJBDEFIK', 'CEBDHFLK',
  'CJBDHFLE', 'CJBDHFEK', 'CEBDHFLI', 'CEBDHFIK', 'CJBDHFEI', 'CGBDEFLK',
  'CGBDJFLE', 'CGBDJFEK', 'CGBDEFLI', 'CGBDEFIK', 'CGBDJFEI', 'CGBDHFLE',
  'CGBDHFEK', 'HGBCJFDE', 'CGBDHFEI', 'HJIFAGLK', 'EJIAHGLK', 'EJIFAHLK',
  'EJIFAGLK', 'EGJFAHLK', 'EGIFAHLK', 'EGJFAHLI', 'EGJFAHIK', 'HJIDAGLK',
  'HJIDAFLK', 'IGJDAFLK', 'HGJDAFLK', 'HGIDAFLK', 'HGJDAFLI', 'HGJDAFIK',
  'EJIDAHLK', 'EJIDAGLK', 'EGJDAHLK', 'EGIDAHLK', 'EGJDAHLI', 'EGJDAHIK',
  'EJIDAFLK', 'HJEDAFLK', 'HEIDAFLK', 'HJEDAFLI', 'HJEDAFIK', 'EGJDAFLK',
  'EGIDAFLK', 'EGJDAFLI', 'EGJDAFIK', 'HGEDAFLK', 'HGJDAFLE', 'HGJDAFEK',
  'HGEDAFLI', 'HGEDAFIK', 'HGJDAFEI', 'HJICAGLK', 'HJICAFLK', 'IGJCAFLK',
  'HGJCAFLK', 'HGICAFLK', 'HGJCAFLI', 'HGJCAFIK', 'EJICAHLK', 'EJICAGLK',
  'EGJCAHLK', 'EGICAHLK', 'EGJCAHLI', 'EGJCAHIK', 'EJICAFLK', 'HJECAFLK',
  'HEICAFLK', 'HJECAFLI', 'HJECAFIK', 'EGJCAFLK', 'EGICAFLK', 'EGJCAFLI',
  'EGJCAFIK', 'HGECAFLK', 'HGJCAFLE', 'HGJCAFEK', 'HGECAFLI', 'HGECAFIK',
  'HGJCAFEI', 'HJICADLK', 'IGJCADLK', 'HGJCADLK', 'HGICADLK', 'HGJCADLI',
  'HGJCADIK', 'CJIDAFLK', 'HJFCADLK', 'HFICADLK', 'HJFCADLI', 'HJFCADIK',
  'CGJDAFLK', 'CGIDAFLK', 'CGJDAFLI', 'CGJDAFIK', 'HGFCADLK', 'CGJDAFLH',
  'HGJCAFDK', 'HGFCADLI', 'HGFCADIK', 'HGJCAFDI', 'EJICADLK', 'HJECADLK',
  'HEICADLK', 'HJECADLI', 'HJECADIK', 'EGJCADLK', 'EGICADLK', 'EGJCADLI',
  'EGJCADIK', 'HGECADLK', 'HGJCADLE', 'HGJCADEK', 'HGECADLI', 'HGECADIK',
  'HGJCADEI', 'CJEDAFLK', 'CEIDAFLK', 'CJEDAFLI', 'CJEDAFIK', 'HEFCADLK',
  'HJFCADLE', 'HJECAFDK', 'HEFCADLI', 'HEFCADIK', 'HJECAFDI', 'CGEDAFLK',
  'CGJDAFLE', 'CGJDAFEK', 'CGEDAFLI', 'CGEDAFIK', 'CGJDAFEI', 'HGFCADLE',
  'HGECAFDK', 'HGJCAFDE', 'HGECAFDI', 'HJBAIGLK', 'HJBAIFLK', 'IJBFAGLK',
  'HJBFAGLK', 'HGBAIFLK', 'HJBFAGLI', 'HJBFAGIK', 'EJBAIHLK', 'EJBAIGLK',
  'EJBAHGLK', 'EGBAIHLK', 'EJBAHGLI', 'EJBAHGIK', 'EJBAIFLK', 'EJBFAHLK',
  'EIBFAHLK', 'EJBFAHLI', 'EJBFAHIK', 'EJBFAGLK', 'EGBAIFLK', 'EJBFAGLI',
  'EJBFAGIK', 'EGBFAHLK', 'HJBFAGLE', 'HJBFAGEK', 'EGBFAHLI', 'EGBFAHIK',
  'HJBFAGEI', 'IJBDAHLK', 'IJBDAGLK', 'HJBDAGLK', 'IGBDAHLK', 'HJBDAGLI',
  'HJBDAGIK', 'IJBDAFLK', 'HJBDAFLK', 'HIBDAFLK', 'HJBDAFLI', 'HJBDAFIK',
  'FJBDAGLK', 'IGBDAFLK', 'FJBDAGLI', 'FJBDAGIK', 'HGBDAFLK', 'HGBDAFLJ',
  'HGBDAFJK', 'HGBDAFLI', 'HGBDAFIK', 'HGBDAFIJ', 'EJBAIDLK', 'EJBDAHLK',
  'EIBDAHLK', 'EJBDAHLI', 'EJBDAHIK', 'EJBDAGLK', 'EGBAIDLK', 'EJBDAGLI',
  'EJBDAGIK', 'EGBDAHLK', 'HJBDAGLE', 'HJBDAGEK', 'EGBDAHLI', 'EGBDAHIK',
  'HJBDAGEI', 'EJBDAFLK', 'EIBDAFLK', 'EJBDAFLI', 'EJBDAFIK', 'HEBDAFLK',
  'HJBDAFLE', 'HJBDAFEK', 'HEBDAFLI', 'HEBDAFIK', 'HJBDAFEI', 'EGBDAFLK',
  'EGBDAFLJ', 'EGBDAFJK', 'EGBDAFLI', 'EGBDAFIK', 'EGBDAFIJ', 'HGBDAFLE',
  'HGBDAFEK', 'HGBDAFEJ', 'HGBDAFEI', 'IJBCAHLK', 'IJBCAGLK', 'HJBCAGLK',
  'IGBCAHLK', 'HJBCAGLI', 'HJBCAGIK', 'IJBCAFLK', 'HJBCAFLK', 'HIBCAFLK',
  'HJBCAFLI', 'HJBCAFIK', 'CJBFAGLK', 'IGBCAFLK', 'CJBFAGLI', 'CJBFAGIK',
  'HGBCAFLK', 'HGBCAFLJ', 'HGBCAFJK', 'HGBCAFLI', 'HGBCAFIK', 'HGBCAFIJ',
  'EJBAICLK', 'EJBCAHLK', 'EIBCAHLK', 'EJBCAHLI', 'EJBCAHIK', 'EJBCAGLK',
  'EGBAICLK', 'EJBCAGLI', 'EJBCAGIK', 'EGBCAHLK', 'HJBCAGLE', 'HJBCAGEK',
  'EGBCAHLI', 'EGBCAHIK', 'HJBCAGEI', 'EJBCAFLK', 'EIBCAFLK', 'EJBCAFLI',
  'EJBCAFIK', 'HEBCAFLK', 'HJBCAFLE', 'HJBCAFEK', 'HEBCAFLI', 'HEBCAFIK',
  'HJBCAFEI', 'EGBCAFLK', 'EGBCAFLJ', 'EGBCAFJK', 'EGBCAFLI', 'EGBCAFIK',
  'EGBCAFIJ', 'HGBCAFLE', 'HGBCAFEK', 'HGBCAFEJ', 'HGBCAFEI', 'IJBCADLK',
  'HJBCADLK', 'HIBCADLK', 'HJBCADLI', 'HJBCADIK', 'CJBDAGLK', 'IGBCADLK',
  'CJBDAGLI', 'CJBDAGIK', 'HGBCADLK', 'HGBCADLJ', 'HGBCADJK', 'HGBCADLI',
  'HGBCADIK', 'HGBCADIJ', 'CJBDAFLK', 'CIBDAFLK', 'CJBDAFLI', 'CJBDAFIK',
  'HFBCADLK', 'CJBDAFLH', 'HJBCAFDK', 'HFBCADLI', 'HFBCADIK', 'HJBCAFDI',
  'CGBDAFLK', 'CGBDAFLJ', 'CGBDAFJK', 'CGBDAFLI', 'CGBDAFIK', 'CGBDAFIJ',
  'CGBDAFLH', 'HGBCAFDK', 'HGBCAFDJ', 'HGBCAFDI', 'EJBCADLK', 'EIBCADLK',
  'EJBCADLI', 'EJBCADIK', 'HEBCADLK', 'HJBCADLE', 'HJBCADEK', 'HEBCADLI',
  'HEBCADIK', 'HJBCADEI', 'EGBCADLK', 'EGBCADLJ', 'EGBCADJK', 'EGBCADLI',
  'EGBCADIK', 'EGBCADIJ', 'HGBCADLE', 'HGBCADEK', 'HGBCADEJ', 'HGBCADEI',
  'CEBDAFLK', 'CJBDAFLE', 'CJBDAFEK', 'CEBDAFLI', 'CEBDAFIK', 'CJBDAFEI',
  'HFBCADLE', 'HEBCAFDK', 'HJBCAFDE', 'HEBCAFDI', 'CGBDAFLE', 'CGBDAFEK',
  'CGBDAFEJ', 'CGBDAFEI', 'HGBCAFDE',
]

if (RAW.length !== 495) {
  throw new Error(`Se esperaban 495 combinaciones, hay ${RAW.length}`)
}

const records = RAW.map((cols, idx) => {
  const combo = idx + 1
  if (cols.length !== 8) {
    throw new Error(`Combo ${combo}: se esperaban 8 letras, hay ${cols.length} ("${cols}")`)
  }

  const assignment = {}
  for (const match of MATCH_ORDER) {
    const group = cols[MATCH_COL_INDEX[match]]
    if (!CANDIDATES[match].includes(group)) {
      throw new Error(
        `Combo ${combo}: el partido ${match} no admite a 3${group} ` +
          `(candidatos ${CANDIDATES[match]})`,
      )
    }
    assignment[match] = group
  }

  const groups = [...cols].sort().join('')
  if (new Set(cols).size !== 8) {
    throw new Error(`Combo ${combo}: grupos duplicados en "${cols}"`)
  }

  return { combo, groups, assignment }
})

// Validar que no haya dos combinaciones con el mismo conjunto de grupos.
const seen = new Map()
for (const r of records) {
  if (seen.has(r.groups)) {
    throw new Error(`Conjunto de grupos duplicado: ${r.groups} (combos ${seen.get(r.groups)} y ${r.combo})`)
  }
  seen.set(r.groups, r.combo)
}

mkdirSync(OUT_DIR, { recursive: true })

// CSV
const header = ['combo', 'groups', ...MATCH_ORDER.map((m) => `M${m}`)].join(',')
const csvLines = records.map((r) =>
  [r.combo, r.groups, ...MATCH_ORDER.map((m) => r.assignment[m])].join(','),
)
const csv = [header, ...csvLines].join('\n') + '\n'
writeFileSync(join(OUT_DIR, 'third-place-allocation.csv'), csv, 'utf8')

// JSON indexado por conjunto de grupos (clave = 8 letras ordenadas A→L).
const byGroups = {}
for (const r of records) {
  byGroups[r.groups] = r.assignment
}
const json = {
  source: '2026 FIFA World Cup Regulations, Annex C',
  description:
    'Mapa: conjunto de los 8 grupos cuyos terceros clasifican (clave ordenada A→L) ' +
    '→ { partido: grupo cuyo tercero juega ahí }.',
  matchesWithThird: MATCH_ORDER,
  candidates: CANDIDATES,
  combinations: byGroups,
}
writeFileSync(
  join(OUT_DIR, 'third-place-allocation.json'),
  JSON.stringify(json, null, 2) + '\n',
  'utf8',
)

console.log(`OK: ${records.length} combinaciones validadas y escritas en public/data/`)
