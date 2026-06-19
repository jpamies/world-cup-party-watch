# Reglas del Mundial 2026 — Desempates y cuadro final

> Referencia para la página `/live` (tablero, clasificaciones y bracket).
> Verificado contra la Wikipedia del 2026 FIFA World Cup y el reglamento FIFA.

Formato: 48 equipos, 12 grupos (A–L) de 4. Pasan a dieciseisavos (Round of 32):
los **2 primeros de cada grupo** (24 equipos) + los **8 mejores terceros**.

---

## 1. Desempate dentro de un grupo (liguilla)

El orden se determina por **puntos** (3 victoria, 1 empate, 0 derrota). Si dos o
más equipos empatan a puntos, se aplican estos criterios **en orden**:

**Criterios head-to-head (solo entre los equipos empatados):**
1. **a)** Mayor número de puntos en los partidos entre los equipos empatados.
2. **b)** Mejor diferencia de goles en los partidos entre los equipos empatados.
3. **c)** Mayor número de goles marcados en los partidos entre los equipos empatados.
4. Si tras aplicar a–c algunos equipos siguen empatados, se **reaplican a–c**
   exclusivamente a los partidos entre los equipos que siguen empatados.

**Criterios globales (todos los partidos del grupo), si lo anterior no decide:**
5. **d)** Mejor diferencia de goles en todos los partidos del grupo.
6. **e)** Mayor número de goles marcados en todos los partidos del grupo.
7. **f)** Mejor puntuación de juego limpio (*fair play*) en todos los partidos del grupo:
   - Tarjeta amarilla: **−1**
   - Roja indirecta (doble amarilla): **−3**
   - Roja directa: **−4**
   - Amarilla + roja directa: **−5**
   - (Solo se aplica una deducción por jugador/oficial en un mismo partido.)
8. **g/h)** Sorteo / último ranking FIFA.

> ✅ Implementación actual en `/live`: **puntos → head-to-head (puntos, DG y
> goles solo entre los empatados; si no se han enfrentado se considera empate)
> → DG global → goles global → nombre**. No se aplican fair play ni ranking FIFA
> (no hay datos de tarjetas ni ranking en la API).

---

## 2. Desempate de los mejores terceros

Se construye una tabla con los **12 terceros** (uno por grupo). Los **8 primeros**
clasifican a dieciseisavos. Criterios de clasificación **en orden**:

1. **Puntos**
2. **Diferencia de goles**
3. **Goles marcados**
4. **Puntuación de juego limpio** (mismo baremo que arriba)
5. **Último ranking FIFA** (11 de junio de 2026)
6. **Ranking(s) FIFA anteriores**

> ⚠️ Implementación actual: **puntos → DG → goles a favor → nombre**.
> Los criterios 4–6 no se aplican (faltan datos de tarjetas y ranking FIFA).

---

## 3. Colocación de los terceros en el cuadro (bracket)

Los emparejamientos de los terceros **dependen de qué 8 grupos** aportan los
terceros clasificados. Hay **495 combinaciones posibles** (Annex C del reglamento).
No se puede saber el rival exacto hasta conocer los 8 grupos.

Los **8 partidos de dieciseisavos** que incluyen un tercero tienen un conjunto
**predefinido de grupos** del que puede venir ese tercero:

| Partido | Local (1º/2º de grupo) | Visitante (tercero de uno de estos grupos) |
|--------:|------------------------|---------------------------------------------|
| **74** | Ganador Grupo E | 3º de **A / B / C / D / F** |
| **77** | Ganador Grupo I | 3º de **C / D / F / G / H** |
| **79** | Ganador Grupo A (México) | 3º de **C / E / F / H / I** |
| **80** | Ganador Grupo L | 3º de **E / H / I / J / K** |
| **81** | Ganador Grupo D | 3º de **B / E / F / I / J** |
| **82** | Ganador Grupo G | 3º de **A / E / H / I / J** |
| **85** | Ganador Grupo B | 3º de **E / F / G / I / J** |
| **87** | Ganador Grupo K | 3º de **D / E / I / J / L** |

La FIFA asigna cada tercero a uno de estos 8 huecos según una tabla fija (Annex C)
que mapea **el conjunto de los 8 grupos clasificados → asignación concreta**, de
modo que ningún tercero se enfrente a un equipo de su propio grupo.

### Tabla Annex C en datos

Las 495 combinaciones están transcritas (verificadas contra Wikipedia
"2026 FIFA World Cup knockout stage") y generadas como archivos de datos:

- [`public/data/third-place-allocation.csv`](../public/data/third-place-allocation.csv)
  — columnas `combo,groups,M74,M77,M79,M80,M81,M82,M85,M87`. `groups` = las 8
  letras (A→L) cuyos terceros clasifican; cada `Mxx` = la letra del grupo cuyo
  tercero juega en ese partido.
- [`public/data/third-place-allocation.json`](../public/data/third-place-allocation.json)
  — indexado por `groups` (clave ordenada A→L) → `{ partido: grupo }`. Listo para
  hacer lookup directo una vez se conozcan los 8 terceros clasificados.

Generador: [`scripts/build-third-place-allocation.mjs`](../scripts/build-third-place-allocation.mjs)
(`node scripts/build-third-place-allocation.mjs`). Valida que cada asignación
caiga dentro de los grupos candidatos de su partido.

> ⚠️ Detalle clave: en la tabla de Wikipedia las 8 columnas de asignación **no**
> van en orden de partido. El orden real de columnas (decodificado resolviendo
> las restricciones) es: `col1→M79, col2→M85, col3→M81, col4→M74, col5→M82,
> col6→M77, col7→M87, col8→M80`.

> En `/live` los dieciseisavos muestran el **token de procedencia** tal cual viene
> del calendario (p. ej. `3ABCDF`, `2A`, `1E`), no el equipo resuelto. Para
> resolver el rival real bastaría con: (1) calcular los 8 mejores terceros, (2)
> ordenar sus grupos A→L, (3) buscar esa clave en el JSON.

---

## 4. Estructura del bracket (feeders)

Tras dieciseisavos, el resto del cuadro es fijo (ganador de partido X):

| Ronda | Partidos | Provienen de |
|-------|----------|--------------|
| Octavos (R16) | 89–96 | ganadores de R32 (W73–W88) |
| Cuartos | 97–100 | ganadores de octavos |
| Semifinales | 101–102 | ganadores de cuartos |
| 3.er puesto | 103 | **perdedores** de semifinales (L101, L102) |
| Final | 104 | ganadores de semifinales (W101, W102) |

Mapa de octavos (verificado con el bracket oficial):

- M89 = W74 vs W77
- M90 = W73 vs W75
- M91 = W76 vs W78
- M92 = W79 vs W80
- M93 = W83 vs W84
- M94 = W81 vs W82
- M95 = W86 vs W88
- M96 = W85 vs W87

Cuartos: M97 = W89/W90 · M98 = W93/W94 · M99 = W91/W92 · M100 = W95/W96
Semis: M101 = W97/W98 · M102 = W99/W100
Final: M104 = W101/W102 · 3.er puesto: M103 = L101/L102

---

## 5. Knockout: empates

En toda la fase eliminatoria, si hay empate al final del tiempo reglamentario:
1. **Prórroga** de 30 minutos.
2. Si persiste el empate, **tanda de penaltis**.
