import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useCalendarData } from '../hooks/useCalendarData'
import { useTimezone } from '../hooks/useTimezone'
import { formatKickoff } from '../utils/date'
import type { CalendarMatch, ChannelId } from '../types/calendar'
import {
  getCountryFlagSrc,
  getCountryShortToken,
} from '../utils/country'
import { getMatchDetails, type MatchDetails } from '../services/fifaMatchDetailsService'

// Annex C allocation table: maps the set of 8 qualified third-place groups
// (key sorted A->L) to { roundOf32MatchNumber: groupLetter whose third plays }.
interface AllocationTable {
  combinations: Record<string, Record<string, string>>
}

// Round-of-32 third-place tokens (from calendar.json) -> their match number.
const THIRD_TOKEN_MATCH: Record<string, number> = {
  '3ABCDF': 74,
  '3CDFGH': 77,
  '3CEFHI': 79,
  '3EHIJK': 80,
  '3BEFIJ': 81,
  '3AEHIJ': 82,
  '3EFGIJ': 85,
  '3DEIJL': 87,
}

interface ResolvedTeam {
  team: string
  flagUrl?: string | null | undefined
}

// Background + text color per group (A-L) for the leading badge.
const GROUP_COLORS: Record<string, { bg: string; fg: string }> = {
  A: { bg: '#e6194b', fg: '#ffffff' },
  B: { bg: '#3cb44b', fg: '#0b0b0b' },
  C: { bg: '#ffd400', fg: '#0b0b0b' },
  D: { bg: '#4363d8', fg: '#ffffff' },
  E: { bg: '#f58231', fg: '#0b0b0b' },
  F: { bg: '#911eb4', fg: '#ffffff' },
  G: { bg: '#19c3e6', fg: '#0b0b0b' },
  H: { bg: '#f032e6', fg: '#ffffff' },
  I: { bg: '#a8d10a', fg: '#0b0b0b' },
  J: { bg: '#ff8fb3', fg: '#0b0b0b' },
  K: { bg: '#2aa198', fg: '#ffffff' },
  L: { bg: '#b5651d', fg: '#ffffff' },
}

// Feeder matches for each knockout match (winner-of / loser-of source numbers).
const KNOCKOUT_FEEDERS: Record<number, [string, string]> = {
  // Round of 16 — winners of the round of 32
  89: ['W74', 'W77'],
  90: ['W73', 'W75'],
  91: ['W76', 'W78'],
  92: ['W79', 'W80'],
  93: ['W83', 'W84'],
  94: ['W81', 'W82'],
  95: ['W86', 'W88'],
  96: ['W85', 'W87'],
  // Quarter-finals
  97: ['W89', 'W90'],
  98: ['W93', 'W94'],
  99: ['W91', 'W92'],
  100: ['W95', 'W96'],
  // Semi-finals
  101: ['W97', 'W98'],
  102: ['W99', 'W100'],
  // Third place (losers of the semi-finals)
  103: ['L101', 'L102'],
  // Final
  104: ['W101', 'W102'],
}

function splitIntoSizedColumns(matches: CalendarMatch[], sizes: number[]) {
  const columns: CalendarMatch[][] = []
  let startIndex = 0

  for (const size of sizes) {
    columns.push(matches.slice(startIndex, startIndex + size))
    startIndex += size
  }

  return columns
}

function getGroupLetter(group: string | undefined): string | null {
  if (!group) {
    return null
  }

  const match = group.match(/([A-L])\s*$/i)
  return match?.[1] ? match[1].toUpperCase() : null
}

function resolveSideToken(match: CalendarMatch, side: 'home' | 'away'): string {
  const raw = side === 'home' ? match.home : match.away

  const feeders = KNOCKOUT_FEEDERS[match.matchNumber]
  if (feeders) {
    return side === 'home' ? feeders[0] : feeders[1]
  }

  if (raw === 'To be announced') {
    return 'TBA'
  }

  return raw
}

function renderFlag(country: string) {
  const flagSrc = getCountryFlagSrc(country)
  if (flagSrc) {
    return (
      <img
        className="board-flag-image"
        src={flagSrc}
        alt=""
        aria-hidden="true"
      />
    )
  }

  return <span className="board-flag-token">{getCountryShortToken(country)}</span>
}

function renderLeadBadge(match: CalendarMatch) {
  if (match.phase === 'groups') {
    const letter = getGroupLetter(match.group)
    if (!letter) {
      return <span className="board-lead-badge" aria-hidden="true" />
    }

    const palette = GROUP_COLORS[letter] ?? { bg: '#353535', fg: '#ffffff' }
    return (
      <span
        className="board-lead-badge board-group-badge"
        style={{ background: palette.bg, color: palette.fg }}
      >
        {letter}
      </span>
    )
  }

  return <span className="board-lead-badge board-match-no">{match.matchNumber}</span>
}

function renderFixtureSide(
  match: CalendarMatch,
  side: 'home' | 'away',
  tokenResolution?: Map<string, ResolvedTeam>,
) {
  if (match.phase === 'groups') {
    const liveFlagUrl = side === 'home' ? match.liveHomeFlagUrl : match.liveAwayFlagUrl
    if (liveFlagUrl) {
      return <img className="board-flag-image" src={liveFlagUrl} alt="" aria-hidden="true" />
    }

    return renderFlag(side === 'home' ? match.home : match.away)
  }

  const token = resolveSideToken(match, side)
  const resolved = tokenResolution?.get(token)
  if (resolved) {
    if (resolved.flagUrl) {
      return <img className="board-flag-image" src={resolved.flagUrl} alt="" aria-hidden="true" />
    }
    return renderFlag(resolved.team)
  }

  return <span className="board-group-origin">{token}</span>
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

interface StandingRow {
  team: string
  group: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
}

function createRow(team: string, group: string): StandingRow {
  return {
    team,
    group,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  }
}

function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.team.localeCompare(b.team)
  })
}

interface HeadToHeadRow {
  points: number
  gd: number
  gf: number
}

// Mini-tabla considerando solo los partidos jugados entre el conjunto de
// equipos empatados. Si dos equipos no se han enfrentado, su aportacion
// head-to-head queda a cero (se considera empate y decide el criterio global).
function buildHeadToHead(teams: string[], matches: CalendarMatch[]): Map<string, HeadToHeadRow> {
  const set = new Set(teams)
  const mini = new Map<string, HeadToHeadRow>(
    teams.map((team) => [team, { points: 0, gd: 0, gf: 0 }]),
  )

  for (const match of matches) {
    if (match.phase !== 'groups') continue
    if (!set.has(match.home) || !set.has(match.away)) continue

    const hs = match.liveHomeScore
    const as = match.liveAwayScore
    if (hs == null || as == null) continue

    const home = mini.get(match.home)!
    const away = mini.get(match.away)!
    home.gf += hs
    away.gf += as
    home.gd += hs - as
    away.gd += as - hs

    if (hs > as) {
      home.points += 3
    } else if (hs < as) {
      away.points += 3
    } else {
      home.points += 1
      away.points += 1
    }
  }

  return mini
}

// Orden FIFA dentro de un grupo: puntos -> head-to-head (puntos, DG, goles
// entre los empatados) -> DG global -> goles global -> nombre.
function sortGroupStandings(rows: StandingRow[], matches: CalendarMatch[]): StandingRow[] {
  const byPoints = [...rows].sort((a, b) => b.points - a.points)
  const result: StandingRow[] = []

  let i = 0
  while (i < byPoints.length) {
    let j = i
    while (j < byPoints.length && byPoints[j]!.points === byPoints[i]!.points) j++
    const cluster = byPoints.slice(i, j)

    if (cluster.length > 1) {
      const h2h = buildHeadToHead(
        cluster.map((row) => row.team),
        matches,
      )
      cluster.sort((a, b) => {
        const ha = h2h.get(a.team)!
        const hb = h2h.get(b.team)!
        if (hb.points !== ha.points) return hb.points - ha.points
        if (hb.gd !== ha.gd) return hb.gd - ha.gd
        if (hb.gf !== ha.gf) return hb.gf - ha.gf
        if (b.gd !== a.gd) return b.gd - a.gd
        if (b.gf !== a.gf) return b.gf - a.gf
        return a.team.localeCompare(b.team)
      })
    }

    result.push(...cluster)
    i = j
  }

  return result
}

function computeGroupStandings(matches: CalendarMatch[]): Map<string, StandingRow[]> {
  const groups = new Map<string, Map<string, StandingRow>>()

  const ensureRow = (letter: string, team: string): StandingRow => {
    let table = groups.get(letter)
    if (!table) {
      table = new Map<string, StandingRow>()
      groups.set(letter, table)
    }
    let row = table.get(team)
    if (!row) {
      row = createRow(team, letter)
      table.set(team, row)
    }
    return row
  }

  for (const match of matches) {
    if (match.phase !== 'groups') continue
    const letter = getGroupLetter(match.group)
    if (!letter) continue

    const home = ensureRow(letter, match.home)
    const away = ensureRow(letter, match.away)

    const hs = match.liveHomeScore
    const as = match.liveAwayScore
    if (hs == null || as == null) continue

    home.played += 1
    away.played += 1
    home.gf += hs
    home.ga += as
    away.gf += as
    away.ga += hs
    home.gd = home.gf - home.ga
    away.gd = away.gf - away.ga

    if (hs > as) {
      home.won += 1
      away.lost += 1
      home.points += 3
    } else if (hs < as) {
      away.won += 1
      home.lost += 1
      away.points += 3
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }

  const result = new Map<string, StandingRow[]>()
  for (const [letter, table] of groups) {
    result.set(letter, sortGroupStandings([...table.values()], matches))
  }
  return result
}

// Map team name -> live flag URL (from finished/ongoing group matches).
function buildFlagMap(matches: CalendarMatch[]): Map<string, string> {
  const flags = new Map<string, string>()
  for (const match of matches) {
    if (match.phase !== 'groups') continue
    if (match.liveHomeFlagUrl) flags.set(match.home, match.liveHomeFlagUrl)
    if (match.liveAwayFlagUrl) flags.set(match.away, match.liveAwayFlagUrl)
  }
  return flags
}

// Given the current standings + Annex C table, work out which group's third
// plays in each of the 8 round-of-32 matches that include a third-placed team.
// Returns null until 8 thirds are known or the combination is missing.
function computeThirdAllocation(
  standings: Map<string, StandingRow[]>,
  allocation: AllocationTable | null,
): Map<number, string> | null {
  if (!allocation) return null

  const thirds: StandingRow[] = []
  for (const rows of standings.values()) {
    if (rows[2]) thirds.push(rows[2])
  }
  if (thirds.length < 8) return null

  const top8 = sortStandings(thirds).slice(0, 8)
  const key = top8
    .map((row) => row.group)
    .sort()
    .join('')

  const mapping = allocation.combinations[key]
  if (!mapping) return null

  const result = new Map<number, string>()
  for (const [matchNo, group] of Object.entries(mapping)) {
    result.set(Number(matchNo), group)
  }
  return result
}

// Build resolution for every group-derived token that appears in the bracket:
// "1X"/"2X" from standings positions, and the eight "3XXXXX" third tokens via
// the Annex C allocation. Returns a map token -> resolved team.
function buildTokenResolution(
  standings: Map<string, StandingRow[]>,
  thirdGroupByMatch: Map<number, string> | null,
  flagMap: Map<string, string>,
): Map<string, ResolvedTeam> {
  const resolution = new Map<string, ResolvedTeam>()

  for (const [letter, rows] of standings) {
    if (rows[0]) resolution.set(`1${letter}`, { team: rows[0].team, flagUrl: flagMap.get(rows[0].team) })
    if (rows[1]) resolution.set(`2${letter}`, { team: rows[1].team, flagUrl: flagMap.get(rows[1].team) })
  }

  if (thirdGroupByMatch) {
    for (const [token, matchNo] of Object.entries(THIRD_TOKEN_MATCH)) {
      const group = thirdGroupByMatch.get(matchNo)
      const row = group ? standings.get(group)?.[2] : undefined
      if (row) resolution.set(token, { team: row.team, flagUrl: flagMap.get(row.team) })
    }
  }

  return resolution
}

// Whether every group match of a given group has already been played.
function isGroupComplete(letter: string, matches: CalendarMatch[]): boolean {
  const groupMatches = matches.filter(
    (match) => match.phase === 'groups' && getGroupLetter(match.group) === letter,
  )
  if (groupMatches.length < 6) return false
  return groupMatches.every(
    (match) => match.liveHomeScore != null && match.liveAwayScore != null,
  )
}

// Remaining (unplayed) matches per team within a group.
// Mathematically confirmed ranks (1-based) for an IN-PROGRESS group.
// Enumerates every remaining win/draw/loss combination and confirms a team's
// position only when it lands on the exact same rank in ALL scenarios, using the
// app tiebreaker order (points -> head-to-head points). Any tie that would fall
// to goal difference (still undecided because future scorelines are unknown) is
// treated as ambiguous, so such teams are never confirmed.
function computeConfirmedRanks(letter: string, matches: CalendarMatch[]): Map<string, number> {
  const teams = new Set<string>()
  const played: { home: string; away: string; homePts: number; awayPts: number }[] = []
  const remaining: { home: string; away: string }[] = []

  for (const match of matches) {
    if (match.phase !== 'groups') continue
    if (getGroupLetter(match.group) !== letter) continue
    teams.add(match.home)
    teams.add(match.away)
    const hs = match.liveHomeScore
    const as = match.liveAwayScore
    if (hs != null && as != null) {
      played.push({
        home: match.home,
        away: match.away,
        homePts: hs > as ? 3 : hs < as ? 0 : 1,
        awayPts: as > hs ? 3 : as < hs ? 0 : 1,
      })
    } else {
      remaining.push({ home: match.home, away: match.away })
    }
  }

  const teamList = [...teams]
  const basePts = new Map<string, number>(teamList.map((team) => [team, 0]))
  for (const result of played) {
    basePts.set(result.home, (basePts.get(result.home) ?? 0) + result.homePts)
    basePts.set(result.away, (basePts.get(result.away) ?? 0) + result.awayPts)
  }

  const possibleRanks = new Map<string, Set<number>>(
    teamList.map((team) => [team, new Set<number>()]),
  )
  const ambiguous = new Set<string>()

  const k = remaining.length
  const scenarios = 3 ** k

  for (let mask = 0; mask < scenarios; mask++) {
    const pts = new Map(basePts)
    const results = [...played]
    let value = mask
    for (let r = 0; r < k; r++) {
      const outcome = value % 3
      value = Math.floor(value / 3)
      const game = remaining[r]!
      const homePts = outcome === 0 ? 3 : outcome === 1 ? 0 : 1
      const awayPts = outcome === 0 ? 0 : outcome === 1 ? 3 : 1
      pts.set(game.home, (pts.get(game.home) ?? 0) + homePts)
      pts.set(game.away, (pts.get(game.away) ?? 0) + awayPts)
      results.push({ home: game.home, away: game.away, homePts, awayPts })
    }

    for (const team of teamList) {
      const teamPts = pts.get(team)!
      const cluster = teamList.filter((other) => pts.get(other)! === teamPts)

      const h2h = new Map<string, number>(cluster.map((member) => [member, 0]))
      if (cluster.length > 1) {
        const clusterSet = new Set(cluster)
        for (const result of results) {
          if (clusterSet.has(result.home) && clusterSet.has(result.away)) {
            h2h.set(result.home, (h2h.get(result.home) ?? 0) + result.homePts)
            h2h.set(result.away, (h2h.get(result.away) ?? 0) + result.awayPts)
          }
        }
      }
      const teamH2H = h2h.get(team) ?? 0

      let strictlyAbove = 0
      let undecidedTie = false
      for (const other of teamList) {
        if (other === team) continue
        const otherPts = pts.get(other)!
        if (otherPts > teamPts) {
          strictlyAbove += 1
        } else if (otherPts === teamPts) {
          const otherH2H = h2h.get(other) ?? 0
          if (otherH2H > teamH2H) strictlyAbove += 1
          else if (otherH2H === teamH2H) undecidedTie = true
        }
      }

      if (undecidedTie) ambiguous.add(team)
      possibleRanks.get(team)!.add(strictlyAbove + 1)
    }
  }

  const confirmed = new Map<string, number>()
  for (const team of teamList) {
    if (ambiguous.has(team)) continue
    const ranks = possibleRanks.get(team)!
    if (ranks.size === 1) confirmed.set(team, [...ranks][0]!)
  }
  return confirmed
}

interface TeamOutcomeState {
  // Guaranteed to finish in the top 2 regardless of remaining results.
  qualifiedTop2: boolean
  // Locked into last place (4th): cannot finish 3rd or better under any
  // remaining result, so it cannot even contend for a best-third slot.
  eliminated: boolean
  // Exact final position is locked (only used to highlight a secured 1st/2nd).
  lockedPosition: number | null
}

// Per-team mathematical outcome for the group table styling. Enumerates every
// remaining win/draw/loss combination (3^k). For each scenario a team's BEST
// possible rank counts only the teams that are certainly above it (more points,
// or equal points with a higher head-to-head record); its WORST possible rank
// additionally assumes it loses every goal-difference-dependent tie. A team is
// "qualifiedTop2" when its worst rank is always <= 2, and "eliminated" when its
// best rank is always >= 4 (mathematically last, so not even a possible third).
// The exact position is locked only when best and worst coincide on a single
// value across all scenarios.
function computeGroupOutcomeStates(
  letter: string,
  matches: CalendarMatch[],
): Map<string, TeamOutcomeState> {
  const teams = new Set<string>()
  const played: { home: string; away: string; homePts: number; awayPts: number }[] = []
  const remaining: { home: string; away: string }[] = []

  for (const match of matches) {
    if (match.phase !== 'groups') continue
    if (getGroupLetter(match.group) !== letter) continue
    teams.add(match.home)
    teams.add(match.away)
    const hs = match.liveHomeScore
    const as = match.liveAwayScore
    if (hs != null && as != null) {
      played.push({
        home: match.home,
        away: match.away,
        homePts: hs > as ? 3 : hs < as ? 0 : 1,
        awayPts: as > hs ? 3 : as < hs ? 0 : 1,
      })
    } else {
      remaining.push({ home: match.home, away: match.away })
    }
  }

  const teamList = [...teams]
  const basePts = new Map<string, number>(teamList.map((team) => [team, 0]))
  for (const result of played) {
    basePts.set(result.home, (basePts.get(result.home) ?? 0) + result.homePts)
    basePts.set(result.away, (basePts.get(result.away) ?? 0) + result.awayPts)
  }

  const worstRank = new Map<string, number>(teamList.map((team) => [team, 0]))
  const bestRank = new Map<string, number>(teamList.map((team) => [team, Infinity]))
  const exactRanks = new Map<string, Set<number>>(
    teamList.map((team) => [team, new Set<number>()]),
  )
  const ambiguous = new Set<string>()

  const k = remaining.length
  const scenarios = 3 ** k

  for (let mask = 0; mask < scenarios; mask++) {
    const pts = new Map(basePts)
    const results = [...played]
    let value = mask
    for (let r = 0; r < k; r++) {
      const outcome = value % 3
      value = Math.floor(value / 3)
      const game = remaining[r]!
      const homePts = outcome === 0 ? 3 : outcome === 1 ? 0 : 1
      const awayPts = outcome === 0 ? 0 : outcome === 1 ? 3 : 1
      pts.set(game.home, (pts.get(game.home) ?? 0) + homePts)
      pts.set(game.away, (pts.get(game.away) ?? 0) + awayPts)
      results.push({ home: game.home, away: game.away, homePts, awayPts })
    }

    for (const team of teamList) {
      const teamPts = pts.get(team)!
      const cluster = teamList.filter((other) => pts.get(other)! === teamPts)

      const h2h = new Map<string, number>(cluster.map((member) => [member, 0]))
      if (cluster.length > 1) {
        const clusterSet = new Set(cluster)
        for (const result of results) {
          if (clusterSet.has(result.home) && clusterSet.has(result.away)) {
            h2h.set(result.home, (h2h.get(result.home) ?? 0) + result.homePts)
            h2h.set(result.away, (h2h.get(result.away) ?? 0) + result.awayPts)
          }
        }
      }
      const teamH2H = h2h.get(team) ?? 0

      let certainlyAbove = 0
      let undecided = 0
      for (const other of teamList) {
        if (other === team) continue
        const otherPts = pts.get(other)!
        if (otherPts > teamPts) {
          certainlyAbove += 1
        } else if (otherPts === teamPts) {
          const otherH2H = h2h.get(other) ?? 0
          if (otherH2H > teamH2H) certainlyAbove += 1
          else if (otherH2H === teamH2H) undecided += 1
        }
      }

      const best = certainlyAbove + 1
      const worst = certainlyAbove + undecided + 1
      if (best < bestRank.get(team)!) bestRank.set(team, best)
      if (worst > worstRank.get(team)!) worstRank.set(team, worst)
      if (undecided > 0) ambiguous.add(team)
      exactRanks.get(team)!.add(best)
    }
  }

  const states = new Map<string, TeamOutcomeState>()
  for (const team of teamList) {
    const ranks = exactRanks.get(team)!
    const locked =
      !ambiguous.has(team) && ranks.size === 1 ? [...ranks][0]! : null
    states.set(team, {
      qualifiedTop2: worstRank.get(team)! <= 2,
      eliminated: bestRank.get(team)! >= 4,
      lockedPosition: locked,
    })
  }
  return states
}

// Build a token resolution that ONLY contains mathematically confirmed slots.
// - "1X"/"2X": a team is confirmed when its exact position cannot change
//   regardless of the remaining results (full enumeration of pending games),
//   or the group is already fully played.
// - Thirds ("3XXXXX"): resolved only once the ENTIRE group stage is finished.
function buildConfirmedResolution(
  standings: Map<string, StandingRow[]>,
  matches: CalendarMatch[],
  allocation: AllocationTable | null,
  flagMap: Map<string, string>,
): Map<string, ResolvedTeam> {
  const resolution = new Map<string, ResolvedTeam>()
  const toResolved = (row: StandingRow): ResolvedTeam => ({
    team: row.team,
    flagUrl: flagMap.get(row.team),
  })

  let allGroupsComplete = standings.size > 0

  for (const [letter, rows] of standings) {
    if (isGroupComplete(letter, matches)) {
      // Group finished: positions are final.
      if (rows[0]) resolution.set(`1${letter}`, toResolved(rows[0]))
      if (rows[1]) resolution.set(`2${letter}`, toResolved(rows[1]))
      continue
    }

    allGroupsComplete = false

    // Group in progress: confirm a slot only when the team's exact rank is the
    // same across every possible combination of the remaining results.
    const confirmedRanks = computeConfirmedRanks(letter, matches)
    const rowByTeam = new Map(rows.map((row) => [row.team, row]))
    for (const [team, rank] of confirmedRanks) {
      const row = rowByTeam.get(team)
      if (!row) continue
      if (rank === 1) resolution.set(`1${letter}`, toResolved(row))
      else if (rank === 2) resolution.set(`2${letter}`, toResolved(row))
    }
  }

  // Thirds only resolve once all groups are complete.
  if (allGroupsComplete && allocation) {
    const thirdGroupByMatch = computeThirdAllocation(standings, allocation)
    if (thirdGroupByMatch) {
      for (const [token, matchNo] of Object.entries(THIRD_TOKEN_MATCH)) {
        const group = thirdGroupByMatch.get(matchNo)
        const row = group ? standings.get(group)?.[2] : undefined
        if (row) resolution.set(token, toResolved(row))
      }
    }
  }

  return resolution
}

function renderTeamFlag(team: string, liveFlagUrl?: string | null) {
  if (liveFlagUrl) {
    return <img className="standings-flag-image" src={liveFlagUrl} alt="" aria-hidden="true" />
  }
  const flagSrc = getCountryFlagSrc(team)
  if (flagSrc) {
    return <img className="standings-flag-image" src={flagSrc} alt="" aria-hidden="true" />
  }
  return <span className="standings-flag-token">{getCountryShortToken(team)}</span>
}

function GroupStandingsGrid({
  standings,
  matches,
}: {
  standings: Map<string, StandingRow[]>
  matches: CalendarMatch[]
}) {
  const letters = [...standings.keys()].sort()
  if (letters.length === 0) return null

  return (
    <div className="standings-grid">
      {letters.map((letter) => {
        const palette = GROUP_COLORS[letter] ?? { bg: '#353535', fg: '#ffffff' }
        const rows = standings.get(letter) ?? []
        const states = computeGroupOutcomeStates(letter, matches)
        return (
          <div key={letter} className="standings-card">
            <header className="standings-card-head">
              <span
                className="standings-badge"
                style={{ background: palette.bg, color: palette.fg }}
              >
                {letter}
              </span>
              <span className="standings-card-title">GROUP {letter}</span>
              <span className="standings-col-head">
                <span>PJ</span>
                <span>DG</span>
                <span>PT</span>
              </span>
            </header>
            <ol className="standings-rows">
              {rows.map((row, index) => {
                const state = states.get(row.team)
                const classNames = ['standings-row']
                if (index < 2) classNames.push('standings-row-qual')
                if (state?.lockedPosition === 1 || state?.lockedPosition === 2) {
                  classNames.push('standings-row-locked')
                }
                if (state?.eliminated) classNames.push('standings-row-eliminated')
                return (
                  <li key={row.team} className={classNames.join(' ')}>
                    <span className="standings-pos">{index + 1}</span>
                    <span className="standings-flag" aria-hidden="true">
                      {renderTeamFlag(row.team)}
                    </span>
                    <span
                      className={
                        state?.qualifiedTop2
                          ? 'standings-name standings-name-qualified'
                          : 'standings-name'
                      }
                    >
                      {row.team}
                    </span>
                    <span className="standings-stat">{row.played}</span>
                    <span className="standings-stat">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
                    <span className="standings-stat standings-pts">{row.points}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

function ThirdPlaceTable({ standings }: { standings: Map<string, StandingRow[]> }) {
  const thirds: StandingRow[] = []
  for (const rows of standings.values()) {
    if (rows[2]) thirds.push(rows[2])
  }
  if (thirds.length === 0) return null

  const ranked = sortStandings(thirds)

  return (
    <div className="thirds-card">
      <header className="thirds-head">
        <span className="thirds-subtitle">Los 8 primeros clasifican a dieciseisavos</span>
      </header>
      <ol className="thirds-rows">
        {ranked.map((row, index) => {
          const palette = GROUP_COLORS[row.group] ?? { bg: '#353535', fg: '#ffffff' }
          return (
            <li
              key={row.team}
              className={index < 8 ? 'thirds-row thirds-row-qual' : 'thirds-row'}
            >
              <span className="thirds-pos">{index + 1}</span>
              <span
                className="standings-badge thirds-badge"
                style={{ background: palette.bg, color: palette.fg }}
              >
                {row.group}
              </span>
              <span className="standings-flag" aria-hidden="true">
                {renderTeamFlag(row.team)}
              </span>
              <span className="thirds-name">{row.team}</span>
              <span className="thirds-stat">{row.played}</span>
              <span className="thirds-stat">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
              <span className="thirds-stat thirds-pts">{row.points}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Knockout bracket
// ---------------------------------------------------------------------------

interface BracketColumn {
  title: string
  matches: CalendarMatch[]
}

function buildBracketColumns(matches: CalendarMatch[]): BracketColumn[] {
  const byPhase = (phase: CalendarMatch['phase']) =>
    matches
      .filter((match) => match.phase === phase)
      .sort((a, b) => a.matchNumber - b.matchNumber)

  const finals = matches
    .filter((match) => match.phase === 'final')
    .sort((a, b) => a.matchNumber - b.matchNumber)

  return [
    { title: 'Dieciseisavos', matches: byPhase('r32') },
    { title: 'Octavos', matches: byPhase('r16') },
    { title: 'Cuartos', matches: byPhase('quarter') },
    { title: 'Semifinales', matches: byPhase('semi') },
    { title: 'Final', matches: finals },
  ].filter((column) => column.matches.length > 0)
}

function bracketScore(match: CalendarMatch, side: 'home' | 'away'): string {
  const value = side === 'home' ? match.liveHomeScore : match.liveAwayScore
  return value != null ? String(value) : ''
}

// True for the eight third-place tokens (e.g. "3ABCDF"), false for "1B"/"2B".
function isThirdToken(token: string): boolean {
  return token.length > 2 && token.startsWith('3')
}

// Short slot label shown next to a provisional team: "2B" stays as-is; a third
// token "3ABCDF" becomes "3X" where X is the group currently allocated to that
// round-of-32 match (or "3.º" if the allocation is not known yet).
function bracketSlotLabel(token: string, thirdGroupByMatch: Map<number, string> | null): string {
  if (isThirdToken(token)) {
    const matchNo = THIRD_TOKEN_MATCH[token]
    const group = matchNo != null ? thirdGroupByMatch?.get(matchNo) : undefined
    return group ? `3${group}` : '3.º'
  }
  return token
}

function renderBracketToken(
  token: string,
  resolved: ResolvedTeam | undefined,
  confirmed: boolean,
  label: string,
  thirdMatchNo: number | null,
  onThirdClick?: (matchNo: number) => void,
) {
  if (!resolved) {
    return <span className="bracket-token">{token}</span>
  }

  const flagSrc = resolved.flagUrl ?? getCountryFlagSrc(resolved.team)
  const nameClass = confirmed
    ? 'bracket-token-name bracket-token-name-confirmed'
    : 'bracket-token-name'
  return (
    <span className="bracket-token bracket-token-resolved">
      {flagSrc ? (
        <img className="bracket-flag-image" src={flagSrc} alt="" aria-hidden="true" />
      ) : null}
      <span className={nameClass}>{resolved.team}</span>
      {!confirmed ? (
        thirdMatchNo != null && onThirdClick ? (
          <button
            type="button"
            className="bracket-slot-tag bracket-slot-tag-third"
            onClick={() => onThirdClick(thirdMatchNo)}
            title="Ver clasificación de terceros"
          >
            {label}
          </button>
        ) : (
          <span className="bracket-slot-tag">{label}</span>
        )
      ) : null}
    </span>
  )
}

function KnockoutBracket({
  matches,
  timeZone,
  tokenResolution,
  confirmedResolution,
  thirdGroupByMatch,
  onThirdClick,
}: {
  matches: CalendarMatch[]
  timeZone: string
  tokenResolution: Map<string, ResolvedTeam>
  confirmedResolution: Map<string, ResolvedTeam>
  thirdGroupByMatch: Map<number, string> | null
  onThirdClick: (matchNo: number) => void
}) {
  const columns = buildBracketColumns(matches)
  if (columns.length === 0) return null

  const renderSide = (match: CalendarMatch, side: 'home' | 'away') => {
    const token = resolveSideToken(match, side)
    const thirdMatchNo = isThirdToken(token) ? THIRD_TOKEN_MATCH[token] ?? null : null
    return renderBracketToken(
      token,
      tokenResolution.get(token),
      confirmedResolution.has(token),
      bracketSlotLabel(token, thirdGroupByMatch),
      thirdMatchNo,
      onThirdClick,
    )
  }

  return (
    <div className="bracket">
      {columns.map((column) => (
        <div key={column.title} className="bracket-column">
          <span className="bracket-column-title">{column.title}</span>
          <div className="bracket-matches">
            {column.matches.map((match) => (
              <div key={match.id} className="bracket-match">
                <div className="bracket-match-top">
                  <span className="bracket-match-no">{match.matchNumber}</span>
                  <div className="bracket-meta">
                    <span className="bracket-venue">{match.location}</span>
                    <span className="bracket-time">
                      {match.kickoffUtc ? formatKickoff(match.kickoffUtc, timeZone) : ''}
                    </span>
                  </div>
                </div>
                <div className="bracket-sides">
                  <div className="bracket-side">
                    {renderSide(match, 'home')}
                    <span className="bracket-score">{bracketScore(match, 'home')}</span>
                  </div>
                  <div className="bracket-side">
                    {renderSide(match, 'away')}
                    <span className="bracket-score">{bracketScore(match, 'away')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const CHANNEL_LABELS: Record<ChannelId, string> = {
  dazn: 'DAZN',
  la1: 'La 1 TVE',
  'rtve-play': 'RTVE Play',
}

function hasPlayed(match: CalendarMatch): boolean {
  return match.liveHomeScore != null && match.liveAwayScore != null
}

function fullKickoff(isoUtc: string, timeZone: string): string {
  const date = new Date(isoUtc)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date)
}

interface VisualViewportRect {
  left: number
  top: number
  width: number
  height: number
}

function readVisualViewportRect(): VisualViewportRect | null {
  if (typeof window === 'undefined' || !window.visualViewport) return null
  const vv = window.visualViewport
  return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height }
}

function useVisualViewportRect(): VisualViewportRect | null {
  const [rect, setRect] = useState<VisualViewportRect | null>(() => readVisualViewportRect())

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const update = () => setRect(readVisualViewportRect())
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return rect
}

// Center a modal in the visible area (so it stays centered when the user has
// pinch-zoomed on mobile, where the layout viewport is wider than the screen).
function viewportModalStyle(viewport: VisualViewportRect | null): CSSProperties | undefined {
  if (!viewport) return undefined
  return {
    position: 'fixed',
    left: viewport.left + viewport.width / 2,
    top: viewport.top + viewport.height / 2,
    transform: 'translate(-50%, -50%)',
    margin: 0,
    width: Math.min(viewport.width - 24, 34 * 16),
    maxWidth: viewport.width - 24,
    maxHeight: viewport.height - 24,
  }
}

function ThirdsInfoModal({
  matchNumber,
  standings,
  thirdGroupByMatch,
  onClose,
}: {
  matchNumber: number
  standings: Map<string, StandingRow[]>
  thirdGroupByMatch: Map<number, string> | null
  onClose: () => void
}) {
  const viewport = useVisualViewportRect()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const thirds: StandingRow[] = []
  for (const rows of standings.values()) {
    if (rows[2]) thirds.push(rows[2])
  }
  const ranked = sortStandings(thirds)
  const allocatedGroup = thirdGroupByMatch?.get(matchNumber) ?? null

  // Token for this round-of-32 match (e.g. "3ABCDF") and its eligible groups.
  const token =
    Object.entries(THIRD_TOKEN_MATCH).find(([, no]) => no === matchNumber)?.[0] ?? null
  const eligibleGroups = token ? token.slice(1).split('') : []

  // The eight qualified third-place groups, sorted (the Annex C draw entry key).
  const qualifiedKey =
    ranked.length >= 8
      ? ranked
          .slice(0, 8)
          .map((row) => row.group)
          .sort()
          .join('·')
      : null

  return (
    <div className="match-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="match-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Clasificación de terceros para el partido ${matchNumber}`}
        style={viewportModalStyle(viewport)}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="match-modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <header className="match-modal-head">
          <span className="match-modal-meta">Mejores terceros · Partido {matchNumber}</span>
        </header>

        {token ? (
          <div className="thirds-token-block">
            <span className="thirds-token-code">{token}</span>
            <span className="thirds-token-text">
              Este cruce SIEMPRE lo juega el 3.º de uno de estos grupos:{' '}
              <strong>{eligibleGroups.join(' · ')}</strong>
            </span>
          </div>
        ) : null}

        {eligibleGroups.length > 0 ? (
          <ul className="thirds-candidates">
            {eligibleGroups.map((letter) => {
              const palette = GROUP_COLORS[letter] ?? { bg: '#353535', fg: '#ffffff' }
              const third = standings.get(letter)?.[2]
              const isAllocated = letter === allocatedGroup
              return (
                <li
                  key={letter}
                  className={`thirds-candidate${isAllocated ? ' thirds-candidate-active' : ''}`}
                >
                  <span
                    className="standings-badge thirds-badge"
                    style={{ background: palette.bg, color: palette.fg }}
                  >
                    {letter}
                  </span>
                  {third ? (
                    <>
                      <span className="standings-flag" aria-hidden="true">
                        {renderTeamFlag(third.team)}
                      </span>
                      <span className="thirds-candidate-name">{third.team}</span>
                    </>
                  ) : (
                    <span className="thirds-candidate-name thirds-candidate-empty">
                      3.º del Grupo {letter}
                    </span>
                  )}
                  {isAllocated ? <span className="thirds-candidate-mark">◄ asignado</span> : null}
                </li>
              )
            })}
          </ul>
        ) : null}

        <p className="thirds-modal-note">
          {allocatedGroup ? (
            <>
              Entrada del sorteo (Anexo C): con los 8 terceros clasificados actuales
              {qualifiedKey ? (
                <>
                  {' '}
                  (<strong>{qualifiedKey}</strong>)
                </>
              ) : null}
              , este cruce recibe el <strong>3.º del Grupo {allocatedGroup}</strong>.
            </>
          ) : (
            'Asignación pendiente: aún no se conocen los 8 mejores terceros.'
          )}{' '}
          El reparto definitivo se fija cuando terminan todos los grupos.
        </p>

        <ol className="thirds-rows thirds-modal-rows">
          {ranked.map((row, index) => {
            const palette = GROUP_COLORS[row.group] ?? { bg: '#353535', fg: '#ffffff' }
            const qualified = index < 8
            const active = row.group === allocatedGroup
            return (
              <li
                key={row.team}
                className={`thirds-row${qualified ? ' thirds-row-qual' : ''}${
                  active ? ' thirds-row-active' : ''
                }`}
              >
                <span className="thirds-pos">{index + 1}</span>
                <span
                  className="standings-badge thirds-badge"
                  style={{ background: palette.bg, color: palette.fg }}
                >
                  {row.group}
                </span>
                <span className="standings-flag" aria-hidden="true">
                  {renderTeamFlag(row.team)}
                </span>
                <span className="thirds-name">{row.team}</span>
                <span className="thirds-stat">{row.played}</span>
                <span className="thirds-stat">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
                <span className="thirds-stat thirds-pts">{row.points}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function MatchDetailModal({
  match,
  resolution,
  timeZone,
  onClose,
}: {
  match: CalendarMatch
  resolution: Map<string, ResolvedTeam>
  timeZone: string
  onClose: () => void
}) {
  const played = hasPlayed(match)
  const [details, setDetails] = useState<MatchDetails | null>(null)
  const [loading, setLoading] = useState(played)
  const [loadError, setLoadError] = useState<string | null>(null)
  const viewport = useVisualViewportRect()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!played || !match.liveIdStage || !match.liveIdMatch) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getMatchDetails(match.liveIdStage, match.liveIdMatch)
      .then((data) => {
        if (!cancelled) setDetails(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Error al cargar el detalle')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [played, match.liveIdStage, match.liveIdMatch])

  const sideLabel = (side: 'home' | 'away'): string => {
    if (match.phase === 'groups') {
      return side === 'home' ? match.home : match.away
    }
    const token = resolveSideToken(match, side)
    return resolution.get(token)?.team ?? token
  }

  const homeLabel = details?.homeName ?? sideLabel('home')
  const awayLabel = details?.awayName ?? sideLabel('away')

  const modalStyle = viewportModalStyle(viewport)

  return (
    <div className="match-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="match-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle ${homeLabel} vs ${awayLabel}`}
        style={modalStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="match-modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <header className="match-modal-head">
          <span className="match-modal-meta">
            {match.phase === 'groups' && match.group
              ? `Grupo ${getGroupLetter(match.group) ?? match.group}`
              : match.matchdayName}{' '}
            · Partido {match.matchNumber}
          </span>
          <div className="match-modal-score">
            <span className="match-modal-team">{homeLabel}</span>
            <span className="match-modal-result">
              {played
                ? `${match.liveHomeScore ?? '—'} - ${match.liveAwayScore ?? '—'}`
                : 'vs'}
            </span>
            <span className="match-modal-team">{awayLabel}</span>
          </div>
          {played && match.liveStatusLabel ? (
            <span className="match-modal-status">{match.liveStatusLabel}</span>
          ) : null}
        </header>

        {played ? (
          <div className="match-modal-body">
            {loading ? <p className="match-modal-note">Cargando eventos…</p> : null}
            {loadError ? <p className="match-modal-note">{loadError}</p> : null}
            {!loading && !loadError && details ? (
              <>
                <section className="match-modal-section">
                  <h3>Goles</h3>
                  {details.goals.length === 0 ? (
                    <p className="match-modal-note">Sin goles registrados.</p>
                  ) : (
                    <ul className="match-modal-events">
                      {details.goals.map((goal, index) => (
                        <li
                          key={`goal-${index}`}
                          className={`match-event match-event-${goal.side}`}
                        >
                          <span className="match-event-minute">{goal.minute}</span>
                          <span className="match-event-icon" aria-hidden="true">
                            ⚽
                          </span>
                          <span className="match-event-player">
                            {goal.player}
                            {goal.penalty ? ' (pen.)' : ''}
                            {goal.ownGoal ? ' (p.p.)' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="match-modal-section">
                  <h3>Tarjetas</h3>
                  {details.cards.length === 0 ? (
                    <p className="match-modal-note">Sin tarjetas.</p>
                  ) : (
                    <ul className="match-modal-events">
                      {details.cards.map((card, index) => (
                        <li
                          key={`card-${index}`}
                          className={`match-event match-event-${card.side}`}
                        >
                          <span className="match-event-minute">{card.minute}</span>
                          <span
                            className={`match-event-card match-event-card-${card.card}`}
                            aria-hidden="true"
                          />
                          <span className="match-event-player">{card.player}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}
          </div>
        ) : (
          <div className="match-modal-body">
            <dl className="match-modal-info">
              <div>
                <dt>Fecha y hora</dt>
                <dd>{fullKickoff(match.kickoffUtc, timeZone)}</dd>
              </div>
              <div>
                <dt>Estadio</dt>
                <dd>{match.location}</dd>
              </div>
              <div>
                <dt>Canales</dt>
                <dd>
                  {match.channels.length === 0
                    ? 'Por confirmar'
                    : match.channels.map((channel) => CHANNEL_LABELS[channel]).join(' · ')}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TournamentBoardPage() {
  const { matches, isLoading, error } = useCalendarData()
  const timeZone = useTimezone()
  const [allocation, setAllocation] = useState<AllocationTable | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<CalendarMatch | null>(null)
  const [selectedThirdMatch, setSelectedThirdMatch] = useState<number | null>(null)

  // Force a desktop-style layout on mobile while viewing the board: widen the
  // viewport so phones render the wide board scaled down instead of squashing it.
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]')
    if (!viewport) return
    const previous = viewport.getAttribute('content')
    viewport.setAttribute('content', 'width=1280')
    return () => {
      viewport.setAttribute('content', previous ?? 'width=device-width, initial-scale=1.0')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('./data/third-place-allocation.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AllocationTable | null) => {
        if (!cancelled) setAllocation(data)
      })
      .catch(() => {
        if (!cancelled) setAllocation(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const mainColumns = useMemo(() => {
    const mainMatches = matches
      .filter((match) => match.phase !== 'final')
      .sort((left, right) => left.matchNumber - right.matchNumber)

    return splitIntoSizedColumns(mainMatches, [22, 22, 22, 18, 18])
  }, [matches])

  const bronzeMatch = useMemo(
    () => matches.find((match) => match.matchNumber === 103),
    [matches],
  )
  const finalMatch = useMemo(
    () => matches.find((match) => match.matchNumber === 104),
    [matches],
  )

  const standings = useMemo(() => computeGroupStandings(matches), [matches])

  const thirdGroupByMatch = useMemo(
    () => computeThirdAllocation(standings, allocation),
    [standings, allocation],
  )

  const tokenResolution = useMemo(() => {
    const flagMap = buildFlagMap(matches)
    return buildTokenResolution(standings, thirdGroupByMatch, flagMap)
  }, [matches, standings, thirdGroupByMatch])

  // Top board: only mathematically confirmed positions (thirds wait until the
  // whole group stage is over). The bracket below stays provisional.
  const confirmedResolution = useMemo(() => {
    const flagMap = buildFlagMap(matches)
    return buildConfirmedResolution(standings, matches, allocation, flagMap)
  }, [matches, standings, allocation])

  if (isLoading) {
    return <section className="status-card">Cargando tablero...</section>
  }

  if (error) {
    return <section className="status-card error">No se pudo cargar el tablero: {error}</section>
  }

  return (
    <section className="board-page" aria-label="Tablero del Mundial 2026">
      <article className="board-frame">
        <header className="board-header">
          <h1>104 MATCHES</h1>
          <Link to="/" className="board-tv-link" aria-label="Ir al calendario Party Watch" title="Calendario Party Watch">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <polyline points="8 21 12 17 16 21" />
            </svg>
          </Link>
          <div className="board-brand" aria-hidden="true">
            <span className="board-brand-number">26</span>
            <span className="board-brand-copy">
              <span>FIFA WORLD CUP</span>
              <span>2026</span>
            </span>
          </div>
        </header>

        <div className="board-body">
          <div className="board-column board-column-left" aria-label="Partidos del tablero">
            <div className="board-main-grid">
              {mainColumns.map((column, columnIndex) => (
                <div key={columnIndex} className="board-main-column">
                  {column.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      className="board-fixture board-fixture-button"
                      onClick={() => setSelectedMatch(match)}
                    >
                      {renderLeadBadge(match)}
                      <span className="board-flag" aria-hidden="true">
                        {renderFixtureSide(match, 'home', confirmedResolution)}
                      </span>
                      <span className="board-match-result board-match-result-live">
                        {match.liveHomeScore != null || match.liveAwayScore != null
                          ? `${match.liveHomeScore ?? '—'}-${match.liveAwayScore ?? '—'}`
                          : 'v'}
                      </span>
                      <span className="board-flag" aria-hidden="true">
                        {renderFixtureSide(match, 'away', confirmedResolution)}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="board-special-row">
              <button
                type="button"
                className="board-final-card board-third-place board-final-button"
                onClick={() => bronzeMatch && setSelectedMatch(bronzeMatch)}
                disabled={!bronzeMatch}
              >
                <span className="board-final-title">BRONZE FINAL</span>
                <span className="board-slot board-slot-wide">L101</span>
                <span className="board-versus">v</span>
                <span className="board-slot board-slot-wide">L102</span>
              </button>

              <button
                type="button"
                className="board-final-card board-final-match board-final-button"
                onClick={() => finalMatch && setSelectedMatch(finalMatch)}
                disabled={!finalMatch}
              >
                <span className="board-final-title">FINAL</span>
                <span className="board-slot board-slot-wide">W101</span>
                <span className="board-versus">v</span>
                <span className="board-slot board-slot-wide">W102</span>
              </button>
            </div>
          </div>
        </div>
      </article>

      <section className="board-extras" aria-label="Clasificaciones y cuadro final">
        <h2 className="board-extras-title">Clasificación de grupos</h2>
        <GroupStandingsGrid standings={standings} matches={matches} />

        <h2 className="board-extras-title">Mejores terceros</h2>
        <ThirdPlaceTable standings={standings} />

        <h2 className="board-extras-title">Cuadro final</h2>
        <KnockoutBracket
          matches={matches}
          timeZone={timeZone}
          tokenResolution={tokenResolution}
          confirmedResolution={confirmedResolution}
          thirdGroupByMatch={thirdGroupByMatch}
          onThirdClick={setSelectedThirdMatch}
        />
      </section>

      {selectedMatch ? (
        <MatchDetailModal
          match={selectedMatch}
          resolution={confirmedResolution}
          timeZone={timeZone}
          onClose={() => setSelectedMatch(null)}
        />
      ) : null}

      {selectedThirdMatch != null ? (
        <ThirdsInfoModal
          matchNumber={selectedThirdMatch}
          standings={standings}
          thirdGroupByMatch={thirdGroupByMatch}
          onClose={() => setSelectedThirdMatch(null)}
        />
      ) : null}
    </section>
  )
}
