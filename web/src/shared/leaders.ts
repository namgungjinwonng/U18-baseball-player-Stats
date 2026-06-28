// 홈 리더보드 + 카테고리별 랭킹 페이지 공용 데이터 정의.
import type { Player } from "./types";

export interface LeaderItem {
  id: string;
  name: string;
  team: string;
  value: string;
  raw: number;
}

// 규정타석/이닝: 규정타석 = 팀 경기수 × 3.1, 규정이닝 = 팀 경기수 × 1.0.
// 팀 경기수 미지정(시합 필터 등) 시 하한.
const PA_PER_GAME = 3.1;
const FALLBACK_MIN_AB = 5;
const FALLBACK_MIN_OUTS = 9;

const rateFmt = (v: number) => (v < 1 ? v.toFixed(3).replace(/^0/, "") : v.toFixed(3));
const intFmt = (n: number) => String(n);
const dec2Fmt = (n: number) => n.toFixed(2);

function outsOf(p: Player): number {
  const ip = p.pitching?.ip ?? 0;
  return Math.floor(ip) * 3 + Math.round((ip % 1) * 10);
}

export type LeaderCategoryId =
  | "avg" | "hr" | "rbi" | "r" | "h" | "sb" | "obp" | "slg" | "ops"
  | "era" | "so" | "w" | "sv" | "ip" | "whip";

export interface LeaderCategory {
  id: LeaderCategoryId;
  title: string;
  kind: "batting" | "pitching";
  needsQualify: boolean; // 규정타석/이닝 필요 (비율 스탯)
  asc: boolean;          // 낮을수록 좋은 지표(평균자책·WHIP) 만 true
  pick: (p: Player) => number | undefined;
  fmt: (n: number) => string;
  shortLabel?: string;   // 카드 헤더 hover 등 보조
}

export const CATEGORIES: LeaderCategory[] = [
  // 타자
  { id: "avg", title: "타율 (규정타석)", kind: "batting", needsQualify: true, asc: false, pick: (p) => p.batting?.avg, fmt: rateFmt },
  { id: "hr", title: "홈런", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.hr, fmt: intFmt },
  { id: "rbi", title: "타점", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.rbi, fmt: intFmt },
  { id: "h", title: "안타", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.h, fmt: intFmt },
  { id: "r", title: "득점", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.r, fmt: intFmt },
  { id: "sb", title: "도루", kind: "batting", needsQualify: false, asc: false, pick: (p) => p.batting?.sb, fmt: intFmt },
  { id: "obp", title: "출루율 (규정타석)", kind: "batting", needsQualify: true, asc: false, pick: (p) => p.batting?.obp, fmt: rateFmt },
  { id: "slg", title: "장타율 (규정타석)", kind: "batting", needsQualify: true, asc: false, pick: (p) => p.batting?.slg, fmt: rateFmt },
  { id: "ops", title: "OPS (규정타석)", kind: "batting", needsQualify: true, asc: false, pick: (p) => (p.batting ? p.batting.obp + p.batting.slg : undefined), fmt: rateFmt },
  // 투수
  { id: "era", title: "평균자책 (규정이닝)", kind: "pitching", needsQualify: true, asc: true, pick: (p) => p.pitching?.era, fmt: dec2Fmt },
  { id: "whip", title: "WHIP (규정이닝)", kind: "pitching", needsQualify: true, asc: true, pick: (p) => p.pitching?.whip, fmt: dec2Fmt },
  { id: "so", title: "탈삼진", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.so, fmt: intFmt },
  { id: "w", title: "승", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.w, fmt: intFmt },
  { id: "sv", title: "세이브", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.sv, fmt: intFmt },
  { id: "ip", title: "이닝", kind: "pitching", needsQualify: false, asc: false, pick: (p) => p.pitching?.ip, fmt: (n) => n.toFixed(1) },
];

export const findCategory = (id: string): LeaderCategory | undefined =>
  CATEGORIES.find((c) => c.id === id);

// 홈 화면 기본 9개 (현재 노출 순). 다른 항목은 카테고리별 랭킹 페이지에서.
export const HOME_CATEGORY_IDS: LeaderCategoryId[] = [
  "avg", "hr", "rbi", "h", "r", "sb", "era", "whip", "so",
];

function qualifyBat(p: Player, teamGames?: Record<string, number>): boolean {
  const g = teamGames?.[p.team];
  const req = g ? g * PA_PER_GAME : FALLBACK_MIN_AB;
  return (p.batting?.pa ?? p.batting?.ab ?? 0) >= req;
}
function qualifyPit(p: Player, teamGames?: Record<string, number>): boolean {
  const g = teamGames?.[p.team];
  const req = g ? g * 3 : FALLBACK_MIN_OUTS;
  return outsOf(p) >= req;
}

export function rankByCategory(
  players: Player[],
  cat: LeaderCategory,
  teamGames?: Record<string, number>,
  limit = Infinity
): LeaderItem[] {
  const qualify = !cat.needsQualify
    ? () => true
    : cat.kind === "batting"
      ? (p: Player) => qualifyBat(p, teamGames)
      : (p: Player) => qualifyPit(p, teamGames);
  const rows = players
    .filter((p) => {
      const v = cat.pick(p);
      return v != null && !Number.isNaN(v) && qualify(p);
    })
    .map((p) => ({ id: p.id, name: p.name, team: p.team, raw: cat.pick(p)! }))
    .sort((a, b) => (cat.asc ? a.raw - b.raw : b.raw - a.raw));
  const sliced = Number.isFinite(limit) ? rows.slice(0, limit) : rows;
  return sliced.map((x) => ({ ...x, value: cat.fmt(x.raw) }));
}

// 홈 카드용 — HOME_CATEGORY_IDS 순서로 TOP N.
export function leaderboards(
  players: Player[],
  teamGames?: Record<string, number>,
  topN = 9
): { id: LeaderCategoryId; title: string; items: LeaderItem[] }[] {
  return HOME_CATEGORY_IDS.map((id) => {
    const cat = findCategory(id)!;
    return { id: cat.id, title: cat.title, items: rankByCategory(players, cat, teamGames, topN) };
  });
}
