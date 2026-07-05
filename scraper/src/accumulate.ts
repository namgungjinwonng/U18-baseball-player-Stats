// 경기 박스스코어(data/games/*.json)를 진실의 원천으로 삼아
// 선수 집계/상대전적/색인/메타를 "파생"한다.
// 집계는 게임 집합의 순수 함수이므로 재실행해도 결과가 동일(멱등)하다.
import fs from "node:fs";
import path from "node:path";
import type {
  BattingStats, GameBoxScore, Matchup, Meta, PitchingStats, Player, PlayerIndexEntry,
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
  clubIdx?: string; // 공식 기록 조회용 팀 ID
}
// 키: `${이름}|${등번호}` → 항목 배열(다른 학교 동명·동번호 충돌 보존).
export type Roster = Record<string, RosterEntry[]>;

export function readRoster(dataDir: string): Roster {
  const fp = path.join(dataDir, "roster.json");
  if (!fs.existsSync(fp)) return {};
  const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as Record<string, RosterEntry | RosterEntry[]>;
  // 구버전(단일 객체) 호환: 배열로 정규화.
  const out: Roster = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v : [v];
  return out;
}

// 로스터 이력(과거 스냅샷 + 선수 프로필의 연도별 출신학교 누적).
// 이적 선수의 "옛 소속" 박스스코어 라인을 personNo 로 조인하기 위한 보조 소스.
// roster.json 과 동일 스키마(키 `이름|번호`, 번호 미상은 `이름|`).
export function readRosterHistory(dataDir: string): Roster {
  const fp = path.join(dataDir, "roster-history.json");
  if (!fs.existsSync(fp)) return {};
  const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as Record<string, RosterEntry | RosterEntry[]>;
  const out: Roster = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v : [v];
  return out;
}

const teamMatches = (rosterTeam: string | undefined, boxTeam: string): boolean =>
  !rosterTeam ||
  rosterTeam.startsWith(boxTeam) ||
  boxTeam.startsWith(rosterTeam) ||
  boxTeam.length < 2;

// (이름,번호) 정확 매칭 우선, 팀명 접두 일치로 후보 압축.
export function lookupRoster(
  roster: Roster, name: string, number: string, boxTeam: string
): RosterEntry | undefined {
  const arr = roster[`${name}|${number}`];
  if (!arr || arr.length === 0) return undefined;
  if (arr.length === 1) return teamMatches(arr[0].team, boxTeam) ? arr[0] : undefined;
  // 다중 후보(동명·동번호 다른 학교): 팀명 일치하는 항목만.
  const matched = arr.filter((e) => e.team && (e.team.startsWith(boxTeam) || boxTeam.startsWith(e.team)));
  return matched.length === 1 ? matched[0] : undefined;
}

// 공식기록 오버레이: personNo → {batting, pitching} (officialStats.collectOfficial 산출물)
export type OfficialMap = Record<string, { batting?: BattingStats; pitching?: PitchingStats }>;

// 팀명 정규화 (참고: U-18 Baseball generate_schedule.py)
// 박스스코어가 너비 제한으로 "한국마사" / "한국마사고" / "한국마사고BC" 처럼 변형해 같은 팀이 여러 이름으로 나오는 문제 해결.
const TEAM_SUFFIXES = ["(U-18)", "야구단", "BC", "고등학교"];
const ALIAS_EXPLICIT: Record<string, string> = {
  "상우고": "상우고야구단",
};
function teamCore(s: string): string {
  let out = s;
  for (const suf of TEAM_SUFFIXES) out = out.split(suf).join("");
  return out.trim();
}
export function buildTeamNormalizer(roster: Roster): (name: string) => string {
  const rosterTeams = new Set<string>();
  for (const arr of Object.values(roster)) for (const ros of arr) if (ros.team) rosterTeams.add(ros.team);
  const officials = [...rosterTeams];
  const coreToOfficial = new Map<string, string>();
  const collisions = new Set<string>();
  for (const t of officials) {
    const c = teamCore(t);
    if (!c) continue;
    if (coreToOfficial.has(c) && coreToOfficial.get(c) !== t) collisions.add(c);
    coreToOfficial.set(c, t);
  }
  // 박스스코어 너비 제한으로 잘린 형태(예: "광남고B"→"광남고BC", "아산BC("→"아산BC(U-18)")
  // 까지 잡으려면 input 을 raw official 명의 접두로도 매칭한다.
  const prefixMatchRaw = (input: string): string | null => {
    if (input.length < 2) return null;
    const cands = officials.filter((o) => o.startsWith(input));
    return cands.length === 1 ? cands[0] : null;
  };
  return (name: string): string => {
    if (!name) return name;
    if (rosterTeams.has(name)) return name;
    if (ALIAS_EXPLICIT[name]) return ALIAS_EXPLICIT[name];
    // 1) 접미사 제거 후 core 일치
    const c = teamCore(name);
    if (c && !collisions.has(c) && coreToOfficial.has(c)) return coreToOfficial.get(c)!;
    // 2) core 끼리 접두 일치 (예: "한국마사" → "한국마사고" → "한국마사고BC")
    if (c && c.length >= 3) {
      const cands = [...coreToOfficial.entries()].filter(([rc]) => rc.startsWith(c));
      if (cands.length === 1) return cands[0][1];
    }
    // 3) 원본 official 명에 input 이 통째로 접두로 들어맞는 경우 (예: "광남고B" → "광남고BC")
    const raw = prefixMatchRaw(name);
    if (raw) return raw;
    // 4) 끝의 불완전 토큰(괄호/숫자) 제거 후 다시 raw 접두 매칭 (예: "아산BC(" → "아산BC")
    const trimmed = name.replace(/[(\[][^)\]]*$/, "").trim();
    if (trimmed && trimmed !== name) {
      const raw2 = prefixMatchRaw(trimmed);
      if (raw2) return raw2;
    }
    return name;
  };
}

export function aggregate(
  games: GameBoxScore[],
  source: string,
  roster: Roster = {},
  official: OfficialMap = {},
  history: Roster = {}
): Aggregated {
  const players = new Map<string, Player>();
  const bAcc = new Map<string, ReturnType<typeof emptyBatting>>();
  const pAcc = new Map<string, ReturnType<typeof emptyPitching>>();
  const pitcherIds = new Set<string>();
  const mAcc = new Map<string, Matchup>();
  const names = new Map<string, string>();
  const normalizeTeam = buildTeamNormalizer(roster);

  // (이름, 정규팀core) → RosterEntry, 단 유일할 때만. 번호 변경/임시번호로 (이름,번호) 매칭이
  // 실패해도 같은 학교에 동명 1명뿐이면 personNo 를 부여해 병합되도록 하는 폴백.
  // roster 키는 `이름|번호` 이므로 이름을 키에서 추출한다.
  // 이력(roster-history)도 포함 — 이적 선수의 옛 소속 라인이 personNo 를 얻어 병합되도록.
  const nameTeamFallback = new Map<string, RosterEntry>(); // `${name}|${teamCore}` → entry
  {
    const pnSet = new Map<string, Set<string>>();
    const rep = new Map<string, RosterEntry>();
    const feed = (src: Roster, preferExisting: boolean) => {
      for (const [k, arr] of Object.entries(src)) {
        const nm = k.split("|")[0];
        for (const e of arr) {
          if (!e.team || !e.personNo) continue;
          const nk = `${nm}|${teamCore(e.team)}`;
          let s = pnSet.get(nk);
          if (!s) { s = new Set(); pnSet.set(nk, s); }
          s.add(e.personNo);
          if (!preferExisting || !rep.has(nk)) rep.set(nk, e);
        }
      }
    };
    feed(roster, false);   // 현행 로스터 우선
    feed(history, true);   // 이력은 빈 자리만 채움
    for (const [nk, s] of pnSet) if (s.size === 1) nameTeamFallback.set(nk, rep.get(nk)!);
  }

  // personNo → 현행(현재 로스터 기준) 항목. 이적 선수의 표시 기준(현재 학교·학년·투타)과
  // personNo 병합 대표 선정에 사용: "현재 기준 표시 + 기록은 합산" 요구사항.
  // 같은 선수가 두 팀 페이지에 동시 게재된 경우(이적 직후)는 프로필 출신학교의
  // 최신(첫 번째) 학교를 현행으로 우선한다. (history 의 번호미상 `이름|` 항목 = 프로필 순서)
  const profileTeamOrder = new Map<string, string[]>(); // name → 최신순 팀 목록
  for (const [k, arr] of Object.entries(history)) {
    if (!k.endsWith("|")) continue;
    const nm = k.slice(0, -1);
    const teams = profileTeamOrder.get(nm) ?? [];
    for (const e of arr) if (e.team && !teams.includes(e.team)) teams.push(e.team);
    profileTeamOrder.set(nm, teams);
  }
  const personNoCurrentEntry = new Map<string, RosterEntry>();
  for (const [k, arr] of Object.entries(roster)) {
    const nm = k.split("|")[0];
    for (const e of arr) {
      if (!e.personNo || !e.team) continue;
      const prev = personNoCurrentEntry.get(e.personNo);
      if (!prev) { personNoCurrentEntry.set(e.personNo, e); continue; }
      const order = profileTeamOrder.get(nm) ?? [];
      const ip = order.indexOf(prev.team!);
      const ie = order.indexOf(e.team);
      if (ie !== -1 && (ip === -1 || ie < ip)) personNoCurrentEntry.set(e.personNo, e);
    }
  }

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
        team: b.team, // 그 경기 당시 소속(이적 선수 병합 후에도 팀별 경기수 정확 계산용)
        opponent: opponentOf(g, b.team),
        line: batterLineText(b),
        title: g.title,
        bStat: { ab: b.ab, h: b.h, b2: b.b2, b3: b.b3, hr: b.hr, rbi: b.rbi, r: b.r, bb: b.bb, hbp: b.hbp, so: b.so, sb: b.sb },
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
        team: pi.team,
        opponent: opponentOf(g, pi.team),
        line: pitcherLineText(pi),
        title: g.title,
        pStat: { outs: pi.outs, h: pi.h, r: pi.r, er: pi.er, bb: pi.bb, so: pi.so, w: pi.w, l: pi.l, sv: pi.sv },
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

  // raw 누적값 → 파생 stats 변환 (personNo merge 후 합산본 재계산에도 사용).
  const deriveBatting = (b: ReturnType<typeof emptyBatting>): BattingStats => {
    const singles = b.h - b.b2 - b.b3 - b.hr;
    const totalBases = singles + 2 * b.b2 + 3 * b.b3 + 4 * b.hr;
    const onBaseDen = b.ab + b.bb + b.hbp;
    return {
      g: b.g, pa: b.ab + b.bb + b.hbp, ab: b.ab, r: b.r, h: b.h, b2: b.b2, b3: b.b3,
      hr: b.hr, rbi: b.rbi, bb: b.bb, hbp: b.hbp, so: b.so, sb: b.sb,
      avg: b.ab ? r3(b.h / b.ab) : 0,
      obp: onBaseDen ? r3((b.h + b.bb + b.hbp) / onBaseDen) : 0,
      slg: b.ab ? r3(totalBases / b.ab) : 0,
    };
  };
  const derivePitching = (pp: ReturnType<typeof emptyPitching>): PitchingStats => {
    const ip = outsToIp(pp.outs);
    return {
      g: pp.g, w: pp.w, l: pp.l, sv: pp.sv, ip,
      h: pp.h, r: pp.r, er: pp.er, bb: pp.bb, so: pp.so,
      era: pp.outs ? r2((pp.er * 27) / pp.outs) : 0,
      whip: pp.outs ? r2(((pp.h + pp.bb) * 3) / pp.outs) : 0,
    };
  };
  // raw 누적값 합산 (중복 슬러그 병합 시).
  const addBatting = (dst: ReturnType<typeof emptyBatting>, s: ReturnType<typeof emptyBatting>) => {
    dst.g += s.g; dst.ab += s.ab; dst.h += s.h; dst.b2 += s.b2; dst.b3 += s.b3;
    dst.hr += s.hr; dst.rbi += s.rbi; dst.r += s.r; dst.bb += s.bb; dst.hbp += s.hbp;
    dst.so += s.so; dst.sb += s.sb;
  };
  const addPitching = (dst: ReturnType<typeof emptyPitching>, s: ReturnType<typeof emptyPitching>) => {
    dst.g += s.g; dst.outs += s.outs; dst.h += s.h; dst.r += s.r; dst.er += s.er;
    dst.bb += s.bb; dst.so += s.so; dst.w += s.w; dst.l += s.l; dst.sv += s.sv;
  };
  // oldId → newId 누적 매핑 (reslug + personNo 병합을 통합해 매치업 재매핑에 사용).
  const reslugRemap = new Map<string, string>();

  // 파생 수치 확정
  for (const [id, p] of players) {
    // 로스터 조인: (이름,번호) 정확 매칭 우선(팀 접두로 동명이인 오조인 방지).
    const number = id.split("_").pop() ?? "";
    p.number = number;
    let ros = lookupRoster(roster, p.name, number, p.team);
    // 현행 로스터에 없으면(이적 후 옛 소속 라인 등) 이력에서 (이름,번호,팀) 정확 매칭.
    if (!ros) ros = lookupRoster(history, p.name, number, p.team);
    // 번호 변경/임시번호로 (이름,번호) 가 안 맞으면 (이름,정규팀) 유일 폴백.
    if (!ros) ros = nameTeamFallback.get(`${p.name}|${teamCore(normalizeTeam(p.team))}`);
    // 이적 선수: 이력으로 조인된 옛 소속 항목이라도 현행 로스터에 등록되어 있으면
    // "현재 소속" 항목 기준으로 표시(고교·학년·투타) — 기록은 아래 병합 단계에서 합산.
    const cur = ros?.personNo ? personNoCurrentEntry.get(ros.personNo) : undefined;
    if (cur && cur.team && ros?.team && cur.team !== ros.team) ros = cur;
    p.position = ros?.position ?? (pitcherIds.has(id) ? "투수" : "타자");
    if (ros?.bats) p.bats = ros.bats;
    if (ros?.throws) p.throws = ros.throws;
    if (ros?.grade) p.grade = ros.grade;
    if (ros?.personNo) p.personNo = ros.personNo;
    if (ros?.region) p.region = ros.region;
    if (ros?.team) p.team = ros.team; // 정식 팀명으로 보정 (로스터 매칭 시)
    p.team = normalizeTeam(p.team); // 로스터 미매칭/축약 팀명도 KBSA 정식명으로 통합
    p.gameLog.reverse(); // 최신순
    const b = bAcc.get(id);
    if (b) p.batting = deriveBatting(b);
    const pp = pAcc.get(id);
    if (pp) p.pitching = derivePitching(pp);
    // 공식기록 우선: personNo 매칭 시 박스스코어 파생값을 공식값으로 교체
    const off = p.personNo ? official[p.personNo] : undefined;
    if (off?.batting && off.batting.g > 0) p.batting = off.batting;
    if (off?.pitching && off.pitching.g > 0) p.pitching = off.pitching;
  }

  // --- 정규팀 슬러그 재생성 → 박스스코어 축약 팀명(광남고B vs 광남고BC)으로 갈라진
  //     동일 선수(같은 정규팀·이름·번호)를 personNo 없이도 병합 ---
  {
    const reslug = new Map<string, string>(); // oldId → newId
    for (const [id, p] of players) {
      const newId = `${p.team}_${p.name}_${p.number}`.replace(/\s+/g, "");
      if (newId !== id) reslug.set(id, newId);
    }
    for (const [oldId, newId] of reslug) {
      const src = players.get(oldId)!;
      const dst = players.get(newId);
      const sb = bAcc.get(oldId), sp = pAcc.get(oldId);
      if (!dst) {
        // 충돌 없음 → 단순 id 교체 (매치업 재매핑에도 반드시 반영 — 누락 시 상대전적 id 가
        // 옛 축약팀 슬러그로 남아 상대 메타/링크/샤드가 모두 깨진다)
        src.id = newId;
        players.delete(oldId); players.set(newId, src);
        if (sb) { bAcc.delete(oldId); bAcc.set(newId, sb); }
        if (sp) { pAcc.delete(oldId); pAcc.set(newId, sp); }
        names.set(newId, src.name);
        reslugRemap.set(oldId, newId);
        continue;
      }
      // 충돌 → 합산 병합
      const seen = new Set(dst.gameLog.map((l) => l.gameId));
      for (const l of src.gameLog) if (!seen.has(l.gameId)) { seen.add(l.gameId); dst.gameLog.push(l); }
      dst.bats ??= src.bats; dst.throws ??= src.throws; dst.grade ??= src.grade;
      dst.region ??= src.region; dst.personNo ??= src.personNo;
      const db = bAcc.get(newId), dp = pAcc.get(newId);
      if (sb) { if (db) { addBatting(db, sb); } else bAcc.set(newId, sb); }
      if (sp) { if (dp) { addPitching(dp, sp); } else pAcc.set(newId, sp); }
      bAcc.delete(oldId); pAcc.delete(oldId);
      players.delete(oldId);
      reslugRemap.set(oldId, newId);
    }
    // 합산 충돌건은 파생 stats 재계산.
    for (const [, newId] of reslug) {
      const p = players.get(newId);
      if (!p) continue;
      const off = p.personNo ? official[p.personNo] : undefined;
      const b = bAcc.get(newId), pp = pAcc.get(newId);
      if (b && !(off?.batting && off.batting.g > 0)) p.batting = deriveBatting(b);
      if (pp && !(off?.pitching && off.pitching.g > 0)) p.pitching = derivePitching(pp);
      p.gameLog.sort((a, c) => c.date.localeCompare(a.date));
    }
  }

  // --- 동일 선수(personNo) 중복 슬러그 병합 (팀명 축약/번호변경 등으로 분리된 항목) ---
  const remap = new Map<string, string>(); // oldId → 대표 id
  {
    const byPerson = new Map<string, Player[]>();
    for (const p of players.values()) {
      if (!p.personNo) continue;
      const arr = byPerson.get(p.personNo) ?? [];
      arr.push(p);
      byPerson.set(p.personNo, arr);
    }
    for (const group of byPerson.values()) {
      if (group.length < 2) continue;
      // 대표: 현행 로스터 소속팀 일치(이적 시 "현재 학교" 기준 표시) → 투타정보 보유 → 경기수 많은 순
      const score = (x: Player) => {
        const cur = x.personNo ? personNoCurrentEntry.get(x.personNo)?.team : undefined;
        return (
          (cur && x.team === cur ? 1_000_000 : 0) +
          (x.throws && x.bats ? 1000 : 0) +
          (x.batting?.g ?? 0) + (x.pitching?.g ?? 0)
        );
      };
      const rep = [...group].sort((a, b) => score(b) - score(a))[0];
      const seen = new Set(rep.gameLog.map((l) => l.gameId));
      const repB = bAcc.get(rep.id);
      const repP = pAcc.get(rep.id);
      let bChanged = false, pChanged = false;
      for (const p of group) {
        if (p.id === rep.id) continue;
        remap.set(p.id, rep.id);
        for (const l of p.gameLog) if (!seen.has(l.gameId)) { seen.add(l.gameId); rep.gameLog.push(l); }
        rep.bats ??= p.bats; rep.throws ??= p.throws; rep.grade ??= p.grade; rep.region ??= p.region;
        // raw 누적값(bAcc/pAcc) 도 합산 → personNo 가 같으면 카운팅도 통합.
        const ob = bAcc.get(p.id);
        if (ob && repB) { addBatting(repB, ob); bChanged = true; }
        const op = pAcc.get(p.id);
        if (op && repP) { addPitching(repP, op); pChanged = true; }
        bAcc.delete(p.id); pAcc.delete(p.id);
        players.delete(p.id);
      }
      // 합산 결과로 derived 재계산 (official 오버레이가 있던 경우는 우선 유지).
      const off = rep.personNo ? official[rep.personNo] : undefined;
      const hasOffB = !!(off?.batting && off.batting.g > 0);
      const hasOffP = !!(off?.pitching && off.pitching.g > 0);
      if (bChanged && repB && !hasOffB) rep.batting = deriveBatting(repB);
      if (pChanged && repP && !hasOffP) rep.pitching = derivePitching(repP);
      rep.gameLog.sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  // --- 번호 미상("0"/빈) 슬러그를 같은 이름·팀의 유일한 실번호 선수로 병합 ---
  // (박스스코어에 번호 없이 등장한 선수. roster 미등록이라 personNo 가 없어 위 병합에서 누락됨.)
  {
    const realByNameTeam = new Map<string, Player[]>(); // 실번호 보유자
    for (const p of players.values()) {
      const num = p.number ?? "";
      if (num && num !== "0") {
        const k = `${p.name}|${p.team}`;
        (realByNameTeam.get(k) ?? realByNameTeam.set(k, []).get(k)!).push(p);
      }
    }
    for (const [id, p] of [...players]) {
      const num = p.number ?? "";
      if (num && num !== "0") continue; // 실번호는 대상 아님
      const cands = realByNameTeam.get(`${p.name}|${p.team}`);
      if (!cands || cands.length !== 1) continue; // 유일할 때만(동명이인 오병합 방지)
      const rep = cands[0];
      remap.set(id, rep.id);
      const seen = new Set(rep.gameLog.map((l) => l.gameId));
      for (const l of p.gameLog) if (!seen.has(l.gameId)) { seen.add(l.gameId); rep.gameLog.push(l); }
      const ob = bAcc.get(id), repB = bAcc.get(rep.id);
      if (ob) { if (repB) addBatting(repB, ob); else bAcc.set(rep.id, ob); bAcc.delete(id); }
      const op = pAcc.get(id), repP = pAcc.get(rep.id);
      if (op) { if (repP) addPitching(repP, op); else pAcc.set(rep.id, op); pAcc.delete(id); }
      players.delete(id);
      const off = rep.personNo ? official[rep.personNo] : undefined;
      const rb = bAcc.get(rep.id), rp = pAcc.get(rep.id);
      if (rb && !(off?.batting && off.batting.g > 0)) rep.batting = deriveBatting(rb);
      if (rp && !(off?.pitching && off.pitching.g > 0)) rep.pitching = derivePitching(rp);
      rep.gameLog.sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  // 매치업 id 정규화: reslug(축약팀 통합) → personNo 대표 순으로 적용.
  const canon = (id: string) => {
    const r = reslugRemap.get(id) ?? id;
    return remap.get(r) ?? r;
  };

  // 매치업 id 재매핑 후 동일 쌍 병합
  const mMerged = new Map<string, Matchup>();
  for (const m of mAcc.values()) {
    const bId = canon(m.batterId);
    const pId = canon(m.pitcherId);
    const key = `${bId}|${pId}`;
    const cur = mMerged.get(key) ?? {
      batterId: bId, batterName: names.get(bId) ?? m.batterName,
      pitcherId: pId, pitcherName: names.get(pId) ?? m.pitcherName,
      pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0, avg: 0,
    };
    cur.pa += m.pa; cur.ab += m.ab; cur.h += m.h; cur.b2 += m.b2; cur.b3 += m.b3;
    cur.hr += m.hr; cur.bb += m.bb; cur.hbp += m.hbp; cur.so += m.so;
    mMerged.set(key, cur);
  }
  const matchups = [...mMerged.values()]
    .map((m) => ({ ...m, avg: m.ab ? r3(m.h / m.ab) : 0 }))
    .sort((a, b) =>
      a.batterName.localeCompare(b.batterName, "ko") ||
      a.pitcherName.localeCompare(b.pitcherName, "ko")
    );

  // 유령 선수(파싱 누락으로 이름·등번호가 빈 행) 제거.
  for (const [id, p] of [...players]) {
    if (!p.name || p.name === "()" || !p.number) players.delete(id);
  }
  const playerList = [...players.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  const index: PlayerIndexEntry[] = playerList.map((p) => ({
    id: p.id, name: p.name, team: p.team, position: p.position,
    number: p.number, grade: p.grade, region: p.region,
    bats: p.bats, throws: p.throws,
  }));

  // 팀별 경기수(규정타석/이닝 기준) — 선수 gameLog 의 distinct 경기 합집합.
  // 이적 선수 병합 후에도 경기 당시 소속(gl.team)으로 귀속시켜 팀 경기수 왜곡 방지.
  const teamGameSets = new Map<string, Set<string>>();
  for (const p of playerList) {
    for (const gl of p.gameLog) {
      const t = gl.team ? normalizeTeam(gl.team) : p.team;
      let s = teamGameSets.get(t);
      if (!s) { s = new Set(); teamGameSets.set(t, s); }
      s.add(gl.gameId);
    }
  }
  const teamGames: Record<string, number> = {};
  for (const [t, s] of teamGameSets) teamGames[t] = s.size;

  const season = ordered.at(-1)?.season ?? new Date().getFullYear();
  const meta: Meta = {
    season,
    lastUpdated: new Date().toISOString(),
    gameCount: games.length,
    source,
    teamGames,
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
  // players/·matchups/ 는 매 실행 전체 재생성 — 이전 실행의 스테일 파일(병합으로
  // 사라진 옛 슬러그 등)이 남아 배포되지 않도록 디렉터리를 비우고 다시 쓴다.
  fs.rmSync(path.join(baseDir, "players"), { recursive: true, force: true });
  fs.rmSync(path.join(baseDir, "matchups"), { recursive: true, force: true });
  // 생성 데이터는 매 실행 전체 재생성되므로 compact JSON(용량/파싱 최적화).
  const w = (rel: string, obj: unknown) => {
    const fp = path.join(baseDir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(obj));
  };
  w("players/index.json", agg.index);
  w("meta.json", agg.meta);
  // 기록 테이블/리더보드용 단일 집계 파일(프론트가 N개 파일 대신 1개만 로드).
  w(
    "records/players.json",
    agg.players.map(({ gameLog: _gl, ...rest }) => rest)
  );
  for (const p of agg.players) w(`players/${p.id}.json`, p);

  // 상대전적 선수별 샤드(모바일 로딩 최적화): 6MB 단일 파일 대신 선수당 수KB.
  // 한 매치업은 타자/투수 양쪽 샤드에 포함된다.
  const byPlayer = new Map<string, Matchup[]>();
  for (const m of agg.matchups) {
    for (const pid of [m.batterId, m.pitcherId]) {
      const arr = byPlayer.get(pid) ?? [];
      arr.push(m);
      byPlayer.set(pid, arr);
    }
  }
  for (const [pid, ms] of byPlayer) w(`matchups/${pid}.json`, ms);
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
