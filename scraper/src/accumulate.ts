// 경기 박스스코어(data/games/*.json)를 진실의 원천으로 삼아
// 선수 집계/상대전적/색인/메타를 "파생"한다.
// 집계는 게임 집합의 순수 함수이므로 재실행해도 결과가 동일(멱등)하다.
import fs from "node:fs";
import path from "node:path";
import type {
  GameBoxScore, Matchup, Meta, Player, PlayerIndexEntry,
} from "./types.js";

// --- 이닝/아웃 변환 ---
export const outsToIp = (outs: number): number => {
  const whole = Math.floor(outs / 3);
  return Number((whole + (outs % 3) / 10).toFixed(1)); // 6.2 표기
};
const r3 = (n: number) => Number(n.toFixed(3));
const r2 = (n: number) => Number(n.toFixed(2));

export interface Aggregated {
  players: Player[];
  index: PlayerIndexEntry[];
  matchups: Matchup[];
  meta: Meta;
}

// 박스스코어에 없는 명단 정보(학년/person_no/포지션/투타) 보강용 오버레이.
// 키: `${이름}|${등번호}` (roster.ts 산출물)
export interface RosterEntry {
  team?: string; // 정식 팀명(박스스코어 축약명 보정)
  region?: string; // 지역
  grade?: string; // 1/2/3
  position?: string; // 내야수/외야수/포수 등
  bats?: string;
  throws?: string;
  personNo?: string; // KBSA 공식 선수 ID
}
export type Roster = Record<string, RosterEntry>;

export function readRoster(dataDir: string): Roster {
  const fp = path.join(dataDir, "roster.json");
  if (!fs.existsSync(fp)) return {};
  return JSON.parse(fs.readFileSync(fp, "utf8")) as Roster;
}

export function aggregate(
  games: GameBoxScore[],
  source: string,
  roster: Roster = {}
): Aggregated {
  const players = new Map<string, Player>();
  const bAcc = new Map<string, ReturnType<typeof emptyBatting>>();
  const pAcc = new Map<string, ReturnType<typeof emptyPitching>>();
  const pitcherIds = new Set<string>();
  const mAcc = new Map<string, Matchup>();
  const names = new Map<string, string>();

  // 경기 시간순 정렬 → gameLog 최신순 출력 위해 뒤에서 reverse
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date));

  function ensure(id: string, name: string, team: string): Player {
    names.set(id, name);
    let p = players.get(id);
    if (!p) {
      p = { id, name, team, position: "타자", season: 0, gameLog: [] };
      players.set(id, p);
    }
    p.name = name;
    p.team = team; // 최신 경기 기준 팀
    return p;
  }

  for (const g of ordered) {
    for (const b of g.batters) {
      const p = ensure(b.playerId, b.name, b.team);
      p.season = g.season;
      const a = bAcc.get(b.playerId) ?? emptyBatting();
      a.g += 1; a.ab += b.ab; a.h += b.h; a.b2 += b.b2; a.b3 += b.b3;
      a.hr += b.hr; a.rbi += b.rbi; a.r += b.r; a.bb += b.bb; a.hbp += b.hbp;
      a.so += b.so; a.sb += b.sb;
      bAcc.set(b.playerId, a);
      p.gameLog.push({
        gameId: g.id, date: g.date,
        opponent: opponentOf(g, b.team),
        line: batterLineText(b),
      });
    }
    for (const pi of g.pitchers) {
      pitcherIds.add(pi.playerId);
      const p = ensure(pi.playerId, pi.name, pi.team);
      p.season = g.season;
      const a = pAcc.get(pi.playerId) ?? emptyPitching();
      a.g += 1; a.outs += pi.outs; a.h += pi.h; a.r += pi.r; a.er += pi.er;
      a.bb += pi.bb; a.so += pi.so; a.w += pi.w; a.l += pi.l; a.sv += pi.sv;
      pAcc.set(pi.playerId, a);
      p.gameLog.push({
        gameId: g.id, date: g.date,
        opponent: opponentOf(g, pi.team),
        line: pitcherLineText(pi),
      });
    }
    for (const m of g.matchups) {
      const key = `${m.batterId}|${m.pitcherId}`;
      const cur = mAcc.get(key) ?? {
        batterId: m.batterId, batterName: names.get(m.batterId) ?? m.batterId,
        pitcherId: m.pitcherId, pitcherName: names.get(m.pitcherId) ?? m.pitcherId,
        pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0, avg: 0,
      };
      cur.ab += m.ab; cur.h += m.h; cur.b2 += m.b2; cur.b3 += m.b3;
      cur.hr += m.hr; cur.bb += m.bb; cur.hbp += m.hbp; cur.so += m.so;
      cur.pa += m.ab + m.bb + m.hbp;
      mAcc.set(key, cur);
    }
  }

  // 파생 수치 확정
  for (const [id, p] of players) {
    // 로스터 조인: `이름|등번호`. 박스스코어 팀명은 축약될 수 있어
    // 팀명 접두 일치로 동명이인 오조인을 방지한다.
    const number = id.split("_").pop() ?? "";
    p.number = number;
    const cand = roster[`${p.name}|${number}`];
    const ros =
      cand &&
      (!cand.team ||
        cand.team.startsWith(p.team) ||
        p.team.startsWith(cand.team) ||
        p.team.length < 2)
        ? cand
        : undefined;
    p.position = ros?.position ?? (pitcherIds.has(id) ? "투수" : "타자");
    if (ros?.bats) p.bats = ros.bats;
    if (ros?.throws) p.throws = ros.throws;
    if (ros?.grade) p.grade = ros.grade;
    if (ros?.personNo) p.personNo = ros.personNo;
    if (ros?.region) p.region = ros.region;
    if (ros?.team) p.team = ros.team; // 정식 팀명으로 보정
    p.gameLog.reverse(); // 최신순
    const b = bAcc.get(id);
    if (b) {
      const singles = b.h - b.b2 - b.b3 - b.hr;
      const totalBases = singles + 2 * b.b2 + 3 * b.b3 + 4 * b.hr;
      const onBaseDen = b.ab + b.bb + b.hbp;
      p.batting = {
        g: b.g, pa: b.ab + b.bb + b.hbp, ab: b.ab, r: b.r, h: b.h, b2: b.b2, b3: b.b3,
        hr: b.hr, rbi: b.rbi, bb: b.bb, hbp: b.hbp, so: b.so, sb: b.sb,
        avg: b.ab ? r3(b.h / b.ab) : 0,
        obp: onBaseDen ? r3((b.h + b.bb + b.hbp) / onBaseDen) : 0,
        slg: b.ab ? r3(totalBases / b.ab) : 0,
      };
    }
    const pp = pAcc.get(id);
    if (pp) {
      const ip = outsToIp(pp.outs);
      p.pitching = {
        g: pp.g, w: pp.w, l: pp.l, sv: pp.sv, ip,
        h: pp.h, r: pp.r, er: pp.er, bb: pp.bb, so: pp.so,
        era: pp.outs ? r2((pp.er * 27) / pp.outs) : 0,
        whip: pp.outs ? r2(((pp.h + pp.bb) * 3) / pp.outs) : 0,
      };
    }
  }

  const matchups = [...mAcc.values()]
    .map((m) => ({
      ...m,
      batterName: names.get(m.batterId) ?? m.batterName,
      pitcherName: names.get(m.pitcherId) ?? m.pitcherName,
      avg: m.ab ? r3(m.h / m.ab) : 0,
    }))
    .sort((a, b) =>
      a.batterName.localeCompare(b.batterName, "ko") ||
      a.pitcherName.localeCompare(b.pitcherName, "ko")
    );

  const playerList = [...players.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const index: PlayerIndexEntry[] = playerList.map((p) => ({
    id: p.id, name: p.name, team: p.team, position: p.position,
    number: p.number, grade: p.grade, region: p.region,
  }));

  const season = ordered.at(-1)?.season ?? new Date().getFullYear();
  const meta: Meta = {
    season,
    lastUpdated: new Date().toISOString(),
    gameCount: games.length,
    source,
  };

  return { players: playerList, index, matchups, meta };
}

function emptyBatting() {
  return { g: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, rbi: 0, r: 0, bb: 0, hbp: 0, so: 0, sb: 0 };
}
function emptyPitching() {
  return { g: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, w: 0, l: 0, sv: 0 };
}
function opponentOf(g: GameBoxScore, team: string): string {
  return team === g.home ? g.away : g.home;
}
function batterLineText(b: { ab: number; h: number; hr: number; rbi: number; bb: number }): string {
  const parts = [`${b.ab}타수 ${b.h}안타`];
  if (b.hr) parts.push(`${b.hr}홈런`);
  if (b.rbi) parts.push(`${b.rbi}타점`);
  if (b.bb) parts.push(`${b.bb}볼넷`);
  return parts.join(" ");
}
function pitcherLineText(p: { outs: number; er: number; so: number; w: number; l: number; sv: number }): string {
  const parts = [`${outsToIp(p.outs)}이닝`, `${p.er}자책`, `${p.so}탈삼진`];
  if (p.w) parts.push("승");
  if (p.l) parts.push("패");
  if (p.sv) parts.push("세이브");
  return parts.join(" ");
}

// --- 파일 입출력 ---
export function readGames(dataDir: string): GameBoxScore[] {
  const dir = path.join(dataDir, "games");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as GameBoxScore);
}

function writeAgg(baseDir: string, agg: Aggregated): void {
  const w = (rel: string, obj: unknown) => {
    const fp = path.join(baseDir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n");
  };
  w("players/index.json", agg.index);
  w("matchups.json", agg.matchups);
  w("meta.json", agg.meta);
  // 기록 테이블/리더보드용 단일 집계 파일(프론트가 N개 파일 대신 1개만 로드).
  w(
    "records/players.json",
    agg.players.map(({ gameLog: _gl, ...rest }) => rest)
  );
  for (const p of agg.players) w(`players/${p.id}.json`, p);
}

// 단일 디렉터리(루트)에 기록 — 테스트/단순용.
export function writeAggregated(dataDir: string, agg: Aggregated): void {
  writeAgg(dataDir, agg);
}

// 연도별 디렉터리(data/{year}/…)에 기록 — 누적/연도 선택용.
export function writeYear(dataDir: string, year: number, agg: Aggregated): void {
  writeAgg(path.join(dataDir, String(year)), agg);
}

// 루트 years.json(내림차순) + 최신 meta.json 기록.
export function writeYearsIndex(dataDir: string, years: number[], latestMeta: Meta): void {
  const sorted = [...years].sort((a, b) => b - a);
  fs.writeFileSync(path.join(dataDir, "years.json"), JSON.stringify(sorted, null, 2) + "\n");
  fs.writeFileSync(path.join(dataDir, "meta.json"), JSON.stringify(latestMeta, null, 2) + "\n");
}

// 경기들을 시즌별로 그룹.
export function groupBySeason(games: GameBoxScore[]): Map<number, GameBoxScore[]> {
  const m = new Map<number, GameBoxScore[]>();
  for (const g of games) {
    const arr = m.get(g.season) ?? [];
    arr.push(g);
    m.set(g.season, arr);
  }
  return m;
}
