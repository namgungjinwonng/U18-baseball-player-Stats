// 학교 A vs 학교 B 대전 모드의 집계 순수 함수 — 맞대결 전적·팀 합계·공통 상대·주요 선수·선수 맞대결표.
import { isQualifiedBat, isQualifiedPit, type QualifyContext } from "./leaders";
import { teamDisplayName } from "./teamRanking";
import type { Matchup, Player, PlayerIndexEntry, ScheduleGame, ScheduleSide } from "./types";

// 모든 화면에서 같은 팀이 두 줄로 갈리지 않도록 클럽 접미사((U-18) 등)를 걷어낸 이름을 키로 쓴다.
export const teamKey = (name: string) => teamDisplayName(name.trim());
export const sameTeam = (a: string, b: string) => teamKey(a) === teamKey(b);

export type Outcome = "승" | "패" | "무";

export interface Record3 {
  w: number;
  l: number;
  d: number;
  rf: number; // 득점
  ra: number; // 실점
}
const emptyRecord = (): Record3 => ({ w: 0, l: 0, d: 0, rf: 0, ra: 0 });

// 한 경기에서 me 쪽 결과 (result 우선, 없으면 점수 비교)
function outcomeOf(me: ScheduleSide, opp: ScheduleSide): Outcome | null {
  if (me.result === "승" || me.result === "패" || me.result === "무") return me.result;
  if (me.score == null || opp.score == null) return null;
  return me.score > opp.score ? "승" : me.score < opp.score ? "패" : "무";
}

function addResult(rec: Record3, me: ScheduleSide, opp: ScheduleSide) {
  const o = outcomeOf(me, opp);
  if (!o) return;
  if (o === "승") rec.w += 1;
  else if (o === "패") rec.l += 1;
  else rec.d += 1;
  rec.rf += me.score ?? 0;
  rec.ra += opp.score ?? 0;
}

// a 팀 기준으로 정리한 경기 한 건 — 화면에서 항상 A를 왼쪽에 둔다.
export interface SideGame {
  game: ScheduleGame;
  me: ScheduleSide;
  opp: ScheduleSide;
  outcome: Outcome | null; // 미완료면 null
}

function sideOf(game: ScheduleGame, team: string): { me: ScheduleSide; opp: ScheduleSide } | null {
  if (sameTeam(game.away.name, team)) return { me: game.away, opp: game.home };
  if (sameTeam(game.home.name, team)) return { me: game.home, opp: game.away };
  return null;
}

const inScope = (game: ScheduleGame, tournamentTitle?: string) =>
  !tournamentTitle || game.title === tournamentTitle;

const byDateDesc = (x: SideGame, y: SideGame) =>
  y.game.date.localeCompare(x.game.date) || y.game.time.localeCompare(x.game.time);

export interface HeadToHead extends Record3 {
  games: SideGame[]; // 최신순, 예정·취소 경기 포함
}

// A vs B 맞대결 — 완료 경기만 승패·득실에 넣고, 목록에는 예정 경기도 보여준다.
export function headToHead(games: ScheduleGame[], a: string, b: string, tournamentTitle?: string): HeadToHead {
  const rec = emptyRecord();
  const list: SideGame[] = [];
  for (const game of games) {
    if (!inScope(game, tournamentTitle)) continue;
    const side = sideOf(game, a);
    if (!side || !sameTeam(side.opp.name, b)) continue;
    const done = game.status === "완료";
    if (done) addResult(rec, side.me, side.opp);
    list.push({ game, ...side, outcome: done ? outcomeOf(side.me, side.opp) : null });
  }
  return { ...rec, games: list.sort(byDateDesc) };
}

// 한 팀의 시즌(또는 대회) 경기 목록 — 팀 상세 페이지용.
export function teamGames(games: ScheduleGame[], team: string, tournamentTitle?: string): SideGame[] {
  const list: SideGame[] = [];
  for (const game of games) {
    if (!inScope(game, tournamentTitle)) continue;
    const side = sideOf(game, team);
    if (!side) continue;
    list.push({ game, ...side, outcome: game.status === "완료" ? outcomeOf(side.me, side.opp) : null });
  }
  return list.sort(byDateDesc);
}

export function teamRecord(games: ScheduleGame[], team: string, tournamentTitle?: string): Record3 {
  const rec = emptyRecord();
  for (const g of teamGames(games, team, tournamentTitle)) {
    if (g.game.status === "완료") addResult(rec, g.me, g.opp);
  }
  return rec;
}

// 두 팀이 모두 상대한 학교별 성적 (A·B 맞대결 자체는 제외). 학교명 가나다순.
export function commonOpponents(
  games: ScheduleGame[],
  a: string,
  b: string,
  tournamentTitle?: string
): { opponent: string; a: Record3; b: Record3 }[] {
  const recs = new Map<string, { a: Record3; b: Record3; seenA: boolean; seenB: boolean }>();
  const get = (opp: string) => {
    let row = recs.get(opp);
    if (!row) {
      row = { a: emptyRecord(), b: emptyRecord(), seenA: false, seenB: false };
      recs.set(opp, row);
    }
    return row;
  };
  for (const game of games) {
    if (game.status !== "완료" || !inScope(game, tournamentTitle)) continue;
    for (const [team, key] of [[a, "a"], [b, "b"]] as const) {
      const side = sideOf(game, team);
      if (!side) continue;
      const opp = teamKey(side.opp.name);
      if (sameTeam(opp, a) || sameTeam(opp, b)) continue;
      const row = get(opp);
      addResult(row[key], side.me, side.opp);
      if (key === "a") row.seenA = true;
      else row.seenB = true;
    }
  }
  return [...recs.entries()]
    .filter(([, row]) => row.seenA && row.seenB)
    .map(([opponent, row]) => ({ opponent, a: row.a, b: row.b }))
    .sort((x, y) => x.opponent.localeCompare(y.opponent, "ko"));
}

const ipToOuts = (ip: number) => Math.floor(ip) * 3 + Math.round((ip - Math.floor(ip)) * 10);
const r3 = (v: number) => Number(v.toFixed(3));
const r2 = (v: number) => Number(v.toFixed(2));

export interface TeamTotals {
  team: string;
  batting: {
    pa: number; ab: number; h: number; b2: number; b3: number; hr: number; bb: number; hbp: number; so: number; sb: number; r: number;
    avg: number; obp: number; slg: number; ops: number;
  };
  pitching: { outs: number; h: number; r: number; er: number; bb: number; so: number; era: number; whip: number; k9: number; bb9: number };
}

// 팀 타격·투구 합계 — 비율은 선수 비율의 평균이 아니라 합산 원자료로 다시 계산한다(통산 모드와 같은 원칙).
export function teamTotals(records: Player[], team: string): TeamTotals | null {
  const rows = records.filter((p) => sameTeam(p.team, team));
  if (rows.length === 0) return null;
  const b = { pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0, sb: 0, r: 0, sf: 0 };
  const p = { outs: 0, h: 0, r: 0, er: 0, bb: 0, so: 0 };
  for (const row of rows) {
    const bt = row.batting;
    if (bt) {
      b.pa += bt.pa; b.ab += bt.ab; b.h += bt.h; b.b2 += bt.b2; b.b3 += bt.b3; b.hr += bt.hr;
      b.bb += bt.bb; b.hbp += bt.hbp; b.so += bt.so; b.sb += bt.sb; b.r += bt.r; b.sf += bt.sf ?? 0;
    }
    const pt = row.pitching;
    if (pt) {
      p.outs += ipToOuts(pt.ip); p.h += pt.h; p.r += pt.r; p.er += pt.er; p.bb += pt.bb; p.so += pt.so;
    }
  }
  const b1 = b.h - b.b2 - b.b3 - b.hr;
  const obpDen = b.ab + b.bb + b.hbp + b.sf;
  const avg = b.ab ? r3(b.h / b.ab) : 0;
  const obp = obpDen ? r3((b.h + b.bb + b.hbp) / obpDen) : 0;
  const slg = b.ab ? r3((b1 + 2 * b.b2 + 3 * b.b3 + 4 * b.hr) / b.ab) : 0;
  const inn = p.outs / 3;
  return {
    team: teamKey(team),
    batting: {
      pa: b.pa, ab: b.ab, h: b.h, b2: b.b2, b3: b.b3, hr: b.hr, bb: b.bb, hbp: b.hbp, so: b.so, sb: b.sb, r: b.r,
      avg, obp, slg, ops: r3(obp + slg),
    },
    pitching: {
      ...p,
      era: p.outs ? r2((p.er * 27) / p.outs) : 0,
      whip: p.outs ? r2(((p.h + p.bb) * 3) / p.outs) : 0,
      k9: inn ? r2((p.so * 9) / inn) : 0,
      bb9: inn ? r2((p.bb * 9) / inn) : 0,
    },
  };
}

const opsOf = (p: Player) => (p.batting ? p.batting.obp + p.batting.slg : 0);

export interface TopPlayers {
  batters: Player[];
  pitchers: Player[];
}

// 팀 주요 선수 — 규정타석·규정이닝 충족 선수 중 OPS·ERA 상위 n명.
export function topPlayers(records: Player[], team: string, ctx: QualifyContext, n = 3): TopPlayers {
  return rankTop(records.filter((p) => sameTeam(p.team, team)), ctx, n);
}

// 전년도 기준 주요 선수 — 시즌 초 규정 충족 선수가 없을 때 쓴다.
// 올해 이 학교 로스터(personNo → 올해 학년)에 있는 선수만 남겨 졸업생은 빼고, 유급·재학생은 남긴다.
// 로스터를 모르면 전년도 같은 학교 선수 중 3학년(대부분 졸업)만 뺀다. 학년은 올해 기준으로 바꿔 보여 준다.
export function returningTopPlayers(
  prevRecords: Player[],
  team: string,
  roster: Map<string, string> | null,
  prevCtx: QualifyContext,
  n = 3
): TopPlayers {
  const rows = prevRecords
    .filter((p) => (roster ? !!p.personNo && roster.has(p.personNo) : sameTeam(p.team, team) && p.grade !== "3"))
    .map((p) => {
      const grade = roster ? roster.get(p.personNo!) : p.grade ? String(Number(p.grade) + 1) : undefined;
      return { ...p, grade: grade || p.grade };
    });
  return rankTop(rows, prevCtx, n);
}

function rankTop(rows: Player[], ctx: QualifyContext, n: number): TopPlayers {
  const batters = rows
    .filter((p) => p.batting && isQualifiedBat(p, ctx))
    .sort((x, y) => opsOf(y) - opsOf(x))
    .slice(0, n);
  const pitchers = rows
    .filter((p) => p.pitching && isQualifiedPit(p, ctx))
    .sort((x, y) => x.pitching!.era - y.pitching!.era || y.pitching!.ip - x.pitching!.ip)
    .slice(0, n);
  return { batters, pitchers };
}

export type MatrixSide = "aBat" | "bBat"; // aBat = A 타자 vs B 투수, bBat = B 타자 vs A 투수

export interface VersusMatrix {
  batters: PlayerIndexEntry[]; // 행 (타석 많은 순)
  pitchers: PlayerIndexEntry[]; // 열 (상대 타석 많은 순)
  cells: Map<string, Matchup>; // `${batterId}|${pitcherId}`
}

export const cellKey = (batterId: string, pitcherId: string) => `${batterId}|${pitcherId}`;

// 상대전적 행(선수 파일 matchups 묶음 또는 대회 matchups.json)에서 두 학교 사이 대결만 골라 표로 만든다.
// 선수 파일에는 타자·투수 양방향이 모두 들어 있어 한 팀 파일만 모아도 양쪽 표를 만들 수 있다.
export function versusMatrix(
  matchups: Matchup[],
  byId: Map<string, PlayerIndexEntry>,
  a: string,
  b: string,
  side: MatrixSide
): VersusMatrix {
  const [batTeam, pitTeam] = side === "aBat" ? [a, b] : [b, a];
  const cells = new Map<string, Matchup>();
  const batterPa = new Map<string, number>();
  const pitcherPa = new Map<string, number>();
  for (const m of matchups) {
    const key = cellKey(m.batterId, m.pitcherId);
    if (cells.has(key)) continue; // 같은 대결이 타자·투수 파일 양쪽에 있다
    const batter = byId.get(m.batterId);
    const pitcher = byId.get(m.pitcherId);
    if (!batter || !pitcher) continue;
    if (!sameTeam(batter.team, batTeam) || !sameTeam(pitcher.team, pitTeam)) continue;
    cells.set(key, m);
    batterPa.set(m.batterId, (batterPa.get(m.batterId) ?? 0) + m.pa);
    pitcherPa.set(m.pitcherId, (pitcherPa.get(m.pitcherId) ?? 0) + m.pa);
  }
  const order = (pa: Map<string, number>) =>
    [...pa.entries()]
      .sort((x, y) => y[1] - x[1] || byId.get(x[0])!.name.localeCompare(byId.get(y[0])!.name, "ko"))
      .map(([id]) => byId.get(id)!);
  return { batters: order(batterPa), pitchers: order(pitcherPa), cells };
}

// 선수 상세 링크 — 선수 ID는 시즌마다 달라 다른 시즌 선수는 KBSA 고유번호 경로(/person)로 보낸다.
// /person 화면은 선택 연도에 기록이 있으면 그 시즌 선수 상세로 자동 이동한다.
export function playerHref(p: { id: string; personNo?: string }, fromYear: number, currentYear: number): string {
  if (fromYear !== currentYear && p.personNo) return `/person/${encodeURIComponent(p.personNo)}`;
  return `/player/${encodeURIComponent(p.id)}`;
}

export interface MergedMatrix extends VersusMatrix {
  yearOf: Map<string, number>; // 대표 선수 ID → 대표 엔트리의 시즌 (링크용)
}

// 여러 시즌 선수 맞대결표를 한 표로 합친다 (통산 맞대결).
// 같은 선수는 personNo(없으면 시즌:ID)로 묶고 가장 최근 시즌 엔트리(이름·학년)를 대표로 쓰며, 같은 대결의 기록은 더한다.
export function mergeMatrices(parts: { year: number; matrix: VersusMatrix }[]): MergedMatrix {
  const keyOf = (p: PlayerIndexEntry, year: number) => (p.personNo ? `pn:${p.personNo}` : `${year}:${p.id}`);
  const rep = new Map<string, { entry: PlayerIndexEntry; year: number }>();
  const sums = new Map<string, Matchup>();
  for (const { year, matrix } of parts) {
    const byId = new Map<string, PlayerIndexEntry>();
    for (const p of [...matrix.batters, ...matrix.pitchers]) {
      byId.set(p.id, p);
      const k = keyOf(p, year);
      const cur = rep.get(k);
      if (!cur || year > cur.year) rep.set(k, { entry: p, year });
    }
    for (const m of matrix.cells.values()) {
      const bk = keyOf(byId.get(m.batterId)!, year);
      const pk = keyOf(byId.get(m.pitcherId)!, year);
      const key = `${bk}|${pk}`;
      const acc = sums.get(key) ?? {
        batterId: bk, batterName: m.batterName, pitcherId: pk, pitcherName: m.pitcherName,
        pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0, avg: 0,
      };
      acc.pa += m.pa; acc.ab += m.ab; acc.h += m.h; acc.b2 += m.b2; acc.b3 += m.b3;
      acc.hr += m.hr; acc.bb += m.bb; acc.hbp += m.hbp; acc.so += m.so;
      acc.avg = acc.ab ? Number((acc.h / acc.ab).toFixed(3)) : 0;
      sums.set(key, acc);
    }
  }
  const cells = new Map<string, Matchup>();
  const batterPa = new Map<string, number>();
  const pitcherPa = new Map<string, number>();
  for (const m of sums.values()) {
    const b = rep.get(m.batterId)!.entry;
    const p = rep.get(m.pitcherId)!.entry;
    cells.set(cellKey(b.id, p.id), { ...m, batterId: b.id, pitcherId: p.id });
    batterPa.set(m.batterId, (batterPa.get(m.batterId) ?? 0) + m.pa);
    pitcherPa.set(m.pitcherId, (pitcherPa.get(m.pitcherId) ?? 0) + m.pa);
  }
  const order = (pa: Map<string, number>) =>
    [...pa.entries()]
      .sort((x, y) => y[1] - x[1] || rep.get(x[0])!.entry.name.localeCompare(rep.get(y[0])!.entry.name, "ko"))
      .map(([k]) => rep.get(k)!.entry);
  const yearOf = new Map([...rep.values()].map(({ entry, year }) => [entry.id, year]));
  return { batters: order(batterPa), pitchers: order(pitcherPa), cells, yearOf };
}
