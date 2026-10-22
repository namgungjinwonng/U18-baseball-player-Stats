// 홈 리더보드 + 카테고리별 랭킹 페이지 공용 데이터 정의.
// 규정타석/규정이닝은 "스코프(전체 시즌 / 주말리그 / 전국대회)" 별로 다르게 적용한다.
// wOBA·wRC+·WAR 카테고리는 리그평균(LeagueRates)이 있어야 계산된다(pick 의 lg 인자).
import type { LeagueRates, Player, PlayerOppIdx } from "./types";
import { battingAdvanced, pitchingAdvanced, signed1, woba } from "./sabermetrics";
import { teamDisplayName } from "./teamRanking";

export interface LeaderItem {
  id: string;
  name: string;
  team: string;
  grade?: string;  // 1/2/3 학년 — 랭킹 행 "이름(학교/학년/투타)" 표기용
  bats?: string;   // 좌/우/양
  throws?: string;
  value: string;
  raw: number;
  qualified: boolean; // 규정 충족 여부 (규정 미달 포함 토글 시 표기용)
  // 가중치 모드(as-is/to-be 비교)에서만 채워짐
  origValue?: string; // 보정 전 원값
  delta?: number;     // 원 순위 − 보정 순위 (양수 = 상승). 규정 충족자만.
}

const rateFmt = (v: number) => (v < 1 ? v.toFixed(3).replace(/^0/, "") : v.toFixed(3));
const intFmt = (n: number) => String(n);
const dec2Fmt = (n: number) => n.toFixed(2);

function outsOf(p: Player): number {
  const ip = p.pitching?.ip ?? 0;
  return Math.floor(ip) * 3 + Math.round((ip % 1) * 10);
}
const paOf = (p: Player) => p.batting?.pa ?? p.batting?.ab ?? 0;

// ─────────────────────────────────────────────────────────────────────────
// 규정 설정 — 연도별로 다를 수 있어 SEASON_CONFIG 에 키로 둔다 (없으면 최신 연도 폴백).
// 2026: 주말리그 전반기 6 + 후반기 6 = 시즌 12경기. 전국대회는 토너먼트.
// ─────────────────────────────────────────────────────────────────────────
export interface SeasonConfig {
  weekendLeagueGames: number; // 주말리그 한 리그(전/후반기) 풀 경기수
  seasonGames: number;        // 시즌 전체 풀 경기수 (전반기+후반기)
  paPerGame: number;          // 규정타석 계수 (타석/경기)
  ipPerGame: number;          // 규정이닝 계수 (이닝/경기)
  nationalMinGames: number;   // 전국대회 최소 출전 경기
  nationalMinPA: number;      // 전국대회 최소 타석
}

const SEASON_CONFIG: Record<number, SeasonConfig> = {
  2026: {
    weekendLeagueGames: 6,
    seasonGames: 12,
    paPerGame: 3.1,
    ipPerGame: 1.0,
    nationalMinGames: 3,
    nationalMinPA: 12,
  },
};

export function seasonConfig(year: number): SeasonConfig {
  if (SEASON_CONFIG[year]) return SEASON_CONFIG[year];
  const years = Object.keys(SEASON_CONFIG).map(Number).sort((a, b) => b - a);
  return SEASON_CONFIG[years[0]] ?? SEASON_CONFIG[2026];
}

export type ScopeKind = "season" | "weekend" | "national";

export interface QualifyContext {
  scope: ScopeKind;
  config: SeasonConfig;
  teamGames: Record<string, number>; // 스코프에 맞는 팀별 경기수 (시즌/리그/대회)
}

function maxGames(tg: Record<string, number>): number {
  let m = 0;
  for (const v of Object.values(tg)) if (v > m) m = v;
  return m;
}

// teamKey와 동일한 정규화 함수를 재사용한다. versus를 직접 가져오면 순환 참조가 생긴다.
function schoolGames(ctx: QualifyContext, team: string): number | undefined {
  if (ctx.teamGames[team] !== undefined) return ctx.teamGames[team];
  const key = teamDisplayName(team.trim());
  const match = Object.keys(ctx.teamGames).find((name) => teamDisplayName(name.trim()) === key);
  return match === undefined ? undefined : ctx.teamGames[match];
}

// 규정 기준 경기수 (팀별):
// - season / weekend: 학교 경기수에 개막기 하한(최대 3경기)과 목표(12 / 6) 상한 적용.
// - 학교 경기수 누락: 기존 전체 최다 경기수 기준으로 폴백.
// - 선수 본인 출전 경기수(playerGames)가 학교 경기수보다 많으면(시즌 중 전학 — 기록은 마지막 학교 이름으로 쌓인다)
//   본인 출전 경기수를 쓴다. 경기를 거의 안 치른 학교로 옮긴 선수의 규정이 하한까지 내려가는 것을 막는다.
// - national: 해당 팀이 그 대회에서 치른 경기수(팀마다 다름).
export function baseGames(ctx: QualifyContext, team: string, playerGames = 0): number {
  const { scope, config, teamGames } = ctx;
  if (scope === "national") return teamGames[team] ?? 0;
  const target = scope === "season" ? config.seasonGames : config.weekendLeagueGames;
  const progressed = maxGames(teamGames);
  // 데이터가 비어있으면(progressed=0) 0 → 규정 0 (모두 노출).
  if (progressed === 0) return 0;
  const ownGames = schoolGames(ctx, team);
  return ownGames === undefined
    ? Math.min(target, progressed)
    : Math.min(target, Math.max(ownGames, playerGames, Math.min(3, progressed)));
}

export function regPA(ctx: QualifyContext, team: string, playerGames = 0): number {
  return Math.floor(baseGames(ctx, team, playerGames) * ctx.config.paPerGame);
}
export function regOuts(ctx: QualifyContext, team: string, playerGames = 0): number {
  return Math.floor(baseGames(ctx, team, playerGames) * ctx.config.ipPerGame) * 3;
}

export function isQualifiedBat(p: Player, ctx: QualifyContext): boolean {
  if (paOf(p) < regPA(ctx, p.team, p.batting?.g ?? 0)) return false;
  if (ctx.scope === "national") {
    if ((p.batting?.g ?? 0) < ctx.config.nationalMinGames) return false;
    if (paOf(p) < ctx.config.nationalMinPA) return false;
  }
  return true;
}
export function isQualifiedPit(p: Player, ctx: QualifyContext): boolean {
  if (outsOf(p) < regOuts(ctx, p.team, p.pitching?.g ?? 0)) return false;
  if (ctx.scope === "national") {
    if ((p.pitching?.g ?? 0) < ctx.config.nationalMinGames) return false;
  }
  return true;
}

// 규정 기준 설명 문구 (캡션용). team·playerGames를 주면 그 선수 기준(학교 경기 수·본인 출전 경기 수)으로 설명한다.
export function describeQualify(ctx: QualifyContext, kind: "batting" | "pitching", team?: string, playerGames = 0): string {
  const c = ctx.config;
  if (ctx.scope === "national") {
    // 선수 기준: 그 학교의 대회 경기 수로 계산한 규정과 최소 출전 조건을 함께 보인다.
    if (team !== undefined) {
      const name = teamDisplayName(team.trim());
      const games = ctx.teamGames[team] ?? 0;
      return kind === "batting"
        ? `규정타석 ${Math.max(regPA(ctx, team), c.nationalMinPA)} 이상 · ${c.nationalMinGames}경기 이상 출전 (${name} 대회 ${games}경기 기준)`
        : `규정이닝 ${regOuts(ctx, team) / 3} 이상 · ${c.nationalMinGames}경기 이상 등판 (${name} 대회 ${games}경기 기준)`;
    }
    return kind === "batting"
      ? `규정타석 = 팀 경기수×${c.paPerGame} (최소 ${c.nationalMinGames}경기·${c.nationalMinPA}타석)`
      : `규정이닝 = 팀 경기수×${c.ipPerGame} (최소 ${c.nationalMinGames}경기)`;
  }
  const target = ctx.scope === "season" ? c.seasonGames : c.weekendLeagueGames;
  if (team === undefined) {
    return kind === "batting"
      ? `규정타석 = 학교 경기 수×${c.paPerGame} (최대 ${Math.floor(target * c.paPerGame)}타석)`
      : `규정이닝 = 학교 경기 수×${c.ipPerGame.toFixed(1)} (최대 ${Math.floor(target * c.ipPerGame)}이닝)`;
  }
  const base = baseGames(ctx, team, playerGames);
  const ownGames = schoolGames(ctx, team);
  const name = teamDisplayName(team.trim()); // 안내 문구에는 (U-18) 표기를 붙이지 않는다
  const own = ownGames === undefined ? "" : `${name} ${ownGames}경기${playerGames > ownGames ? ` · 본인 출전 ${playerGames}경기` : ""}`;
  const basis = ownGames === undefined
    ? `${name} 경기 수 미확인 · 전체 최다 ${maxGames(ctx.teamGames)}경기 · ${base}경기 기준`
    : Math.max(ownGames, playerGames) > target
      ? `${own} · 최대 ${base}경기 기준`
      : playerGames > ownGames
        ? `${own} 기준`
        : ownGames < base
          ? `${own} · 하한 ${base}경기 기준`
          : `${name} ${base}경기 기준`;
  return kind === "batting"
    ? `규정타석 ${regPA(ctx, team, playerGames)} 이상 (${basis})`
    : `규정이닝 ${regOuts(ctx, team, playerGames) / 3} 이상 (${basis})`;
}

// ─────────────────────────────────────────────────────────────────────────
export type LeaderCategoryId =
  | "avg" | "hr" | "rbi" | "r" | "h" | "sb" | "obp" | "slg" | "ops"
  | "woba" | "wraa" | "wrc" | "war-bat"
  | "era" | "so" | "w" | "sv" | "ip" | "whip" | "war-pit";

// 상대 가중치 적용 방식 (undefined = 누적 지표 — 가중치 미적용):
//  bat-rate: 값 × ob (강한 투수진 상대일수록 상향) / pit-rate: 값 ÷ op (강타선 상대일수록 하향=호전)
//  bat-adv/pit-adv: 비교 기준 리그평균을 "실제 상대한 수준"으로 치환해 재계산 (wOBA÷ob, ERA×op)
export type WeightKind = "bat-rate" | "bat-adv" | "pit-rate" | "pit-adv";

export interface LeaderCategory {
  id: LeaderCategoryId;
  title: string;
  kind: "batting" | "pitching";
  needsQualify: boolean; // 규정타석/이닝 필요 (비율 스탯)
  asc: boolean;          // 낮을수록 좋은 지표(평균자책·WHIP) 만 true
  weight?: WeightKind;   // 상대 가중치 적용 방식 (없으면 누적 지표 — 미적용)
  // lg = 리그평균 (wRC+/WAR 산출용 — 없으면 해당 카테고리는 빈 목록)
  pick: (p: Player, lg?: LeagueRates | null) => number | undefined;
  fmt: (n: number) => string;
}

// 가중치 적용 값: 카테고리의 weight 방식에 따라 원값을 보정. idx 없으면 중립(1.0) = 원값.
export function weightedPick(
  p: Player,
  cat: LeaderCategory,
  lg?: LeagueRates | null,
  idx?: PlayerOppIdx
): number | undefined {
  switch (cat.weight) {
    case "bat-rate": {
      const raw = cat.pick(p, lg);
      return raw != null ? raw * (idx?.ob ?? 1) : undefined;
    }
    case "pit-rate": {
      const raw = cat.pick(p, lg);
      const op = idx?.op ?? 1;
      return raw != null && op > 0 ? raw / op : raw ?? undefined;
    }
    case "bat-adv": {
      // 기대 wOBA = 리그 wOBA ÷ ob (강한 투수진 상대면 기대치가 낮다) → wRAA/wRC+/WAR 재계산
      const ob = idx?.ob ?? 1;
      return cat.pick(p, lg ? { ...lg, woba: lg.woba / ob } : lg);
    }
    case "pit-adv": {
      // 기대 실점 = 리그 ERA × op (강타선 상대면 기대 실점이 높다) → WAR 재계산
      const op = idx?.op ?? 1;
      return cat.pick(p, lg ? { ...lg, era: lg.era * op } : lg);
    }
    default:
      return cat.pick(p, lg);
  }
}

export const CATEGORIES: LeaderCategory[] = [
  // 타자
  { id: "avg", title: "타율 (규정타석)", kind: "batting", needsQualify: true, asc: false, weight: "bat-rate", pick: (p) => p.batting?.avg, fmt: rateFmt },
  { id: "hr", title: "홈런", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.hr, fmt: intFmt },
  { id: "rbi", title: "타점", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.rbi, fmt: intFmt },
  { id: "h", title: "안타", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.h, fmt: intFmt },
  { id: "r", title: "득점", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.r, fmt: intFmt },
  { id: "sb", title: "도루", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.sb, fmt: intFmt },
  { id: "obp", title: "출루율 (규정타석)", kind: "batting", needsQualify: true, asc: false, weight: "bat-rate", pick: (p) => p.batting?.obp, fmt: rateFmt },
  { id: "slg", title: "장타율 (규정타석)", kind: "batting", needsQualify: true, asc: false, weight: "bat-rate", pick: (p) => p.batting?.slg, fmt: rateFmt },
  { id: "ops", title: "OPS (규정타석)", kind: "batting", needsQualify: true, asc: false, weight: "bat-rate", pick: (p) => (p.batting ? p.batting.obp + p.batting.slg : undefined), fmt: rateFmt },
  { id: "woba", title: "wOBA (규정타석)", kind: "batting", needsQualify: true, asc: false, weight: "bat-rate", pick: (p) => (p.batting ? woba(p.batting) : undefined), fmt: rateFmt },
  { id: "wraa", title: "wRAA (타자)", kind: "batting", needsQualify: false, asc: false, weight: "bat-adv", pick: (p, lg) => (p.batting ? battingAdvanced(p.batting, lg).wraa : undefined), fmt: signed1 },
  { id: "wrc", title: "wRC+ (규정타석)", kind: "batting", needsQualify: true, asc: false, weight: "bat-adv", pick: (p, lg) => (p.batting ? battingAdvanced(p.batting, lg).wrcPlus : undefined), fmt: intFmt },
  { id: "war-bat", title: "WAR (타자)", kind: "batting", needsQualify: false, asc: false, weight: "bat-adv", pick: (p, lg) => (p.batting ? battingAdvanced(p.batting, lg).war : undefined), fmt: (n) => n.toFixed(1) },
  // 투수
  { id: "era", title: "평균자책 (규정이닝)", kind: "pitching", needsQualify: true, asc: true, weight: "pit-rate", pick: (p) => p.pitching?.era, fmt: dec2Fmt },
  { id: "whip", title: "WHIP (규정이닝)", kind: "pitching", needsQualify: true, asc: true, weight: "pit-rate", pick: (p) => p.pitching?.whip, fmt: dec2Fmt },
  { id: "so", title: "탈삼진", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.so, fmt: intFmt },
  { id: "w", title: "승", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.w, fmt: intFmt },
  { id: "sv", title: "세이브", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.sv, fmt: intFmt },
  { id: "ip", title: "이닝", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.ip, fmt: (n) => n.toFixed(1) },
  { id: "war-pit", title: "WAR (투수)", kind: "pitching", needsQualify: false, asc: false, weight: "pit-adv", pick: (p, lg) => (p.pitching ? pitchingAdvanced(p.pitching, lg).war : undefined), fmt: (n) => n.toFixed(1) },
];

export const findCategory = (id: string): LeaderCategory | undefined =>
  CATEGORIES.find((c) => c.id === id);

// 홈 화면 기본 9개 (현재 노출 순). 다른 항목은 카테고리별 랭킹 페이지에서.
export const HOME_CATEGORY_IDS: LeaderCategoryId[] = [
  "avg", "hr", "rbi", "h", "r", "sb", "era", "whip", "so",
];

export function rankByCategory(
  players: Player[],
  cat: LeaderCategory,
  ctx?: QualifyContext,
  limit = Infinity,
  includeUnqualified = false,
  lg?: LeagueRates | null,
  // 가중치 모드: 선수 id → 상대 난이도 지수. 지정 + cat.weight 있으면 보정값으로 랭킹하고
  // as-is(원값·원순위) 비교 정보(origValue/delta)를 채운다.
  weights?: Record<string, PlayerOppIdx> | null,
): LeaderItem[] {
  const needsQ = cat.needsQualify && !!ctx;
  const qualifies = (p: Player): boolean => {
    if (!needsQ) return true;
    return cat.kind === "batting" ? isQualifiedBat(p, ctx!) : isQualifiedPit(p, ctx!);
  };
  const weighted = !!weights && !!cat.weight;
  const rows = players
    .map((p) => {
      const raw = cat.pick(p, lg);
      const adj = weighted ? weightedPick(p, cat, lg, weights![p.id]) : raw;
      return { p, raw, adj };
    })
    .filter((x) => x.raw != null && !Number.isNaN(x.raw) && x.adj != null && !Number.isNaN(x.adj))
    .map((x) => ({
      id: x.p.id, name: x.p.name, team: x.p.team,
      grade: x.p.grade, bats: x.p.bats, throws: x.p.throws,
      raw: x.adj as number, origRaw: x.raw as number, qualified: qualifies(x.p),
    }))
    .filter((x) => includeUnqualified || x.qualified)
    .sort((a, b) => (cat.asc ? a.raw - b.raw : b.raw - a.raw));

  // as-is 순위(규정 충족자만 번호 부여 — 화면 순번과 동일 규칙)로 delta 계산
  let baseRankOf: Map<string, number> | null = null;
  if (weighted) {
    baseRankOf = new Map();
    const base = [...rows].sort((a, b) => (cat.asc ? a.origRaw - b.origRaw : b.origRaw - a.origRaw));
    let r = 0;
    for (const x of base) if (x.qualified) baseRankOf.set(x.id, ++r);
  }

  const sliced = Number.isFinite(limit) ? rows.slice(0, limit) : rows;
  let rank = 0;
  return sliced.map((x) => {
    if (x.qualified) rank += 1;
    const item: LeaderItem = {
      id: x.id, name: x.name, team: x.team, grade: x.grade, bats: x.bats, throws: x.throws,
      raw: x.raw, value: cat.fmt(x.raw), qualified: x.qualified,
    };
    if (weighted) {
      item.origValue = cat.fmt(x.origRaw);
      if (x.qualified && baseRankOf!.has(x.id)) item.delta = baseRankOf!.get(x.id)! - rank;
    }
    return item;
  });
}

// 홈 카드용 — 기본은 HOME_CATEGORY_IDS 순서로 TOP N (규정 충족자만).
// categoryIds 지정 시 그 목록으로 (모바일 캐러셀 = 전 항목).
export function leaderboards(
  players: Player[],
  ctx: QualifyContext,
  topN = 9,
  weights?: Record<string, PlayerOppIdx> | null,
  categoryIds: LeaderCategoryId[] = HOME_CATEGORY_IDS,
): { id: LeaderCategoryId; title: string; weighted: boolean; items: LeaderItem[] }[] {
  return categoryIds.map((id) => {
    const cat = findCategory(id)!;
    return {
      id: cat.id,
      title: cat.title,
      weighted: !!weights && !!cat.weight,
      items: rankByCategory(players, cat, ctx, topN, false, undefined, weights),
    };
  });
}
