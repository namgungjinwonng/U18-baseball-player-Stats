// 상대 강도(팀 타격/투수 지수) + 선수별 상대 난이도 지수 계산 → data/{year}/strength.json
//
// 목적: 리더보드/랭킹의 "상대 가중치 적용" 모드용 사전 집계.
//  - 팀 강도: 경기 원본(박스스코어)에서 팀별 wOBA(타격) / 피wOBA(투수) → 리그 대비 지수(1.0 = 평균).
//    · 순환 보정 1회: 상대한 팀들의 강도로 자기 지수를 재조정 (iterative SOS 1-pass).
//    · 지역 shrinkage: 경기수가 적은 팀은 소속 지역 평균 쪽으로 축소 (표본 안정화).
//    · 소프트 클램프: 0.85~1.15 는 원값, 초과분은 tanh 압축으로 0.7~1.3 에 점근 — 극단값을
//      누르되 경계 동률 없이 서열 보존 (콜드게임·대량득점 왜곡 방지).
//  - 선수 난이도: 개별 선수 gameLog 를 순회, 경기별 노출량(타자=타석, 투수=상대타자수 근사)으로
//    상대팀 강도를 가중 평균 → ob(타자가 상대한 투수진 난이도) / op(투수가 상대한 타선 난이도).
//    시합별 지수도 같은 방식(팀 강도는 시즌 기준 고정 — 시합 내 소표본 왜곡 방지).
//
// 실행: 수집 파이프라인(index.ts)이 집계 후 자동 호출. 단독 재계산은 npm run strength.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildTeamNormalizer, groupBySeason, readGames, readRoster } from "./accumulate.js";
import { WOBA_WEIGHTS } from "./leagueAverages.js";
import type { GameBoxScore, Player } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "..", "..", "data");

// index.ts 의 tournamentSlug 와 동일하게 유지할 것 (by-tournament 디렉터리 슬러그와 일치 필요).
function tournamentSlug(title: string): string {
  let s = title.trim().replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "-");
  if (s.length > 80) s = s.slice(0, 80);
  return s || "untitled";
}

function shardName(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 64).toString(16).padStart(2, "0");
}

const SHRINK_K = 6; // 지역 shrinkage 의 사전 가중(경기수 환산) — 팀 경기 6개 = 지역:팀 반반
// 소프트 클램프: 1±CORE(0.85~1.15) 구간은 원값 유지, 초과분은 tanh 로 점진 압축해
// 1±(CORE+TAIL) = 0.7~1.3 에 점근. 하드 클램프는 경계값(0.85/1.15)에 팀 30개가 눌려
// 상·하위권 내부 서열이 사라졌음 — 순단조 함수라 동률 없이 서열 보존.
const CORE = 0.15;
const TAIL = 0.15;
const CLAMP_MIN = 0.7; // = 1 - CORE - TAIL (점근 하한)
const CLAMP_MAX = 1.3; // = 1 + CORE + TAIL (점근 상한)
const clamp = (v: number) => {
  const d = v - 1;
  const a = Math.abs(d);
  if (a <= CORE) return v;
  return 1 + Math.sign(d) * (CORE + TAIL * Math.tanh((a - CORE) / TAIL));
};
const r3 = (v: number) => Number(v.toFixed(3));

interface WobaAcc { num: number; den: number }
const acc = (): WobaAcc => ({ num: 0, den: 0 });
function addLine(a: WobaAcc, l: { ab: number; h: number; b2: number; b3: number; hr: number; bb: number; hbp: number }) {
  const b1 = l.h - l.b2 - l.b3 - l.hr;
  const W = WOBA_WEIGHTS;
  a.num += W.bb * l.bb + W.hbp * l.hbp + W.b1 * b1 + W.b2 * l.b2 + W.b3 * l.b3 + W.hr * l.hr;
  a.den += l.ab + l.bb + l.hbp; // sf 미보유 → 근사
}

export interface TeamStrength { bat: number; pit: number; g: number; region?: string }
export interface PlayerOppIdx { ob?: number; op?: number } // ob=타자 상대투수 난이도, op=투수 상대타선 난이도
export interface StrengthData {
  season: number;
  updatedAt: string;
  params: { shrinkK: number; clamp: [number, number] };
  teams: Record<string, TeamStrength>;
  players: Record<string, PlayerOppIdx>; // 시즌 스코프
  tournaments: Record<string, Record<string, PlayerOppIdx>>; // slug → id → 지수
}

function computeTeamStrength(
  games: GameBoxScore[],
  normalize: (n: string) => string,
  teamRegion: Map<string, string>
): Record<string, TeamStrength> {
  // 팀별 타격(자신) / 피타격(상대 투수진) 집계 + 경기별 노출(순환 보정용)
  const bat = new Map<string, WobaAcc>();
  const against = new Map<string, WobaAcc>();
  const gamesOf = new Map<string, number>();
  // 순환 보정용: 팀별 [상대팀, 타석수] 노출 목록
  const batExposure = new Map<string, { opp: string; pa: number }[]>();
  const lg = acc();

  for (const g of games) {
    const teamsInGame = new Set<string>();
    // 경기 내 팀별 타석 집계 (라인 단위 team 필드 기준 — home/away 표기 불일치 회피)
    const paByTeam = new Map<string, number>();
    for (const l of g.batters) {
      const t = normalize(l.team);
      teamsInGame.add(t);
      const a = bat.get(t) ?? acc();
      addLine(a, l);
      bat.set(t, a);
      addLine(lg, l);
      paByTeam.set(t, (paByTeam.get(t) ?? 0) + l.ab + l.bb + l.hbp);
    }
    const pair = [...teamsInGame];
    if (pair.length !== 2) continue; // 비정상 박스스코어는 팀 지수 계산에서 제외
    for (const [me, opp] of [[pair[0], pair[1]], [pair[1], pair[0]]] as const) {
      gamesOf.set(me, (gamesOf.get(me) ?? 0) + 1);
      // 상대 타자 라인 = 내 투수진의 피타격
      const a = against.get(me) ?? acc();
      for (const l of g.batters) if (normalize(l.team) === opp) addLine(a, l);
      against.set(me, a);
      const exp = batExposure.get(me) ?? [];
      exp.push({ opp, pa: paByTeam.get(me) ?? 0 });
      batExposure.set(me, exp);
    }
  }

  const lgWoba = lg.den ? lg.num / lg.den : 0;
  if (!lgWoba) return {};

  // 1차: 원시 지수
  const batRaw = new Map<string, number>();
  const pitRaw = new Map<string, number>();
  for (const [t, a] of bat) if (a.den) batRaw.set(t, a.num / a.den / lgWoba);
  for (const [t, a] of against) if (a.den) pitRaw.set(t, lgWoba / (a.num / a.den));

  // 2차: 상대 강도로 1회 재조정 — 강한 투수진 상대였으면 타격 지수 상향, 강타선 상대였으면 투수 지수 상향
  const bat2 = new Map<string, number>();
  const pit2 = new Map<string, number>();
  for (const [t, exps] of batExposure) {
    let wPit = 0, wBat = 0, wSum = 0;
    for (const e of exps) {
      wPit += e.pa * (pitRaw.get(e.opp) ?? 1);
      wBat += e.pa * (batRaw.get(e.opp) ?? 1);
      wSum += e.pa;
    }
    const oppPit = wSum ? wPit / wSum : 1;
    const oppBat = wSum ? wBat / wSum : 1;
    if (batRaw.has(t)) bat2.set(t, batRaw.get(t)! * oppPit);
    if (pitRaw.has(t)) pit2.set(t, pitRaw.get(t)! * oppBat);
  }

  // 지역 shrinkage: 지역 평균(경기수 가중) 쪽으로 축소
  const regionAgg = new Map<string, { bat: number; pit: number; w: number }>();
  for (const [t, b] of bat2) {
    const region = teamRegion.get(t);
    if (!region) continue;
    const w = gamesOf.get(t) ?? 0;
    const ra = regionAgg.get(region) ?? { bat: 0, pit: 0, w: 0 };
    ra.bat += b * w;
    ra.pit += (pit2.get(t) ?? 1) * w;
    ra.w += w;
    regionAgg.set(region, ra);
  }

  const out: Record<string, TeamStrength> = {};
  for (const [t, b] of bat2) {
    const n = gamesOf.get(t) ?? 0;
    const region = teamRegion.get(t);
    const ra = region ? regionAgg.get(region) : undefined;
    const rBat = ra && ra.w ? ra.bat / ra.w : 1;
    const rPit = ra && ra.w ? ra.pit / ra.w : 1;
    const p = pit2.get(t) ?? 1;
    out[t] = {
      bat: r3(clamp((n * b + SHRINK_K * rBat) / (n + SHRINK_K))),
      pit: r3(clamp((n * p + SHRINK_K * rPit) / (n + SHRINK_K))),
      g: n,
      region,
    };
  }
  return out;
}

// 선수 gameLog → 스코프별(시즌/시합) 상대 난이도 지수
function computePlayerIdx(
  dataDir: string,
  year: number,
  slimIds: string[],
  teams: Record<string, TeamStrength>,
  normalize: (n: string) => string
): { players: Record<string, PlayerOppIdx>; tournaments: Record<string, Record<string, PlayerOppIdx>> } {
  const players: Record<string, PlayerOppIdx> = {};
  const tournaments: Record<string, Record<string, PlayerOppIdx>> = {};
  const pDir = path.join(dataDir, String(year), "players");
  const shardCache = new Map<string, Record<string, Player>>();
  let missing = 0;

  for (const id of slimIds) {
    const legacyFp = path.join(pDir, `${id}.json`);
    const shardFp = path.join(pDir, "shards", `${shardName(id)}.json`);
    let p: Player | undefined;
    if (fs.existsSync(shardFp)) {
      let shard = shardCache.get(shardFp);
      if (!shard) {
        shard = JSON.parse(fs.readFileSync(shardFp, "utf8")) as Record<string, Player>;
        shardCache.set(shardFp, shard);
      }
      p = shard[id];
    } else if (fs.existsSync(legacyFp)) {
      p = JSON.parse(fs.readFileSync(legacyFp, "utf8")) as Player;
    }
    if (!p) { missing++; continue; }
    if (!p.gameLog) continue;
    // scope key "" = 시즌 전체, 그 외 = tournament slug
    const scopes = new Map<string, { ob: WobaAcc; op: WobaAcc }>();
    const scopeAcc = (k: string) => {
      let s = scopes.get(k);
      if (!s) { s = { ob: acc(), op: acc() }; scopes.set(k, s); }
      return s;
    };
    for (const e of p.gameLog) {
      const opp = teams[normalize(e.opponent)];
      const keys = [""].concat(e.title ? [tournamentSlug(e.title)] : []);
      if (e.bStat) {
        const w = e.bStat.ab + e.bStat.bb + e.bStat.hbp; // 타석 근사
        for (const k of keys) { const s = scopeAcc(k); s.ob.num += w * (opp?.pit ?? 1); s.ob.den += w; }
      }
      if (e.pStat) {
        const w = e.pStat.outs + e.pStat.h + e.pStat.bb; // 상대타자수(BF) 근사
        for (const k of keys) { const s = scopeAcc(k); s.op.num += w * (opp?.bat ?? 1); s.op.den += w; }
      }
    }
    for (const [k, s] of scopes) {
      const idx: PlayerOppIdx = {};
      if (s.ob.den > 0) idx.ob = r3(s.ob.num / s.ob.den);
      if (s.op.den > 0) idx.op = r3(s.op.num / s.op.den);
      if (idx.ob == null && idx.op == null) continue;
      if (k === "") players[id] = idx;
      else (tournaments[k] ??= {})[id] = idx;
    }
  }
  if (missing) console.log(`  · 개별 선수 파일 없음(스킵): ${missing}명`);
  return { players, tournaments };
}

// 전 시즌 strength.json 재계산 — 수집 파이프라인(index.ts)이 집계 직후 호출한다.
// records/players.json 과 개별 선수 파일(gameLog)이 이미 갱신된 상태를 전제.
export function buildStrength(dataDir: string = DEFAULT_DATA_DIR): void {
  const bySeason = groupBySeason(readGames(dataDir));

  for (const [year, games] of bySeason) {
    const normalize = buildTeamNormalizer(readRoster(dataDir, year));
    const recFp = path.join(dataDir, String(year), "records", "players.json");
    if (!fs.existsSync(recFp)) continue;
    const slim = JSON.parse(fs.readFileSync(recFp, "utf8")) as Player[];
    const teamRegion = new Map<string, string>();
    for (const p of slim) if (p.region && !teamRegion.has(p.team)) teamRegion.set(p.team, p.region);

    const teams = computeTeamStrength(games, normalize, teamRegion);
    const { players, tournaments } = computePlayerIdx(dataDir, year, slim.map((p) => p.id), teams, normalize);

    const data: StrengthData = {
      season: year,
      updatedAt: new Date().toISOString(),
      params: { shrinkK: SHRINK_K, clamp: [CLAMP_MIN, CLAMP_MAX] },
      teams,
      players,
      tournaments,
    };
    const outFp = path.join(dataDir, String(year), "strength.json");
    fs.writeFileSync(outFp, JSON.stringify(data));
    const kb = (fs.statSync(outFp).size / 1024).toFixed(0);
    console.log(
      `✓ ${year} strength.json — 팀 ${Object.keys(teams).length} · 선수 ${Object.keys(players).length} · 시합 ${Object.keys(tournaments).length} (${kb}KB)`
    );
  }
}

// 단독 실행(npm run strength) 시에만 즉시 계산 — index.ts 가 import 할 땐 실행되지 않도록 가드.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildStrength();
}
