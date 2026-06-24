// 홈 화면 리더보드 계산 (공용).
import type { Player } from "./types";

export interface LeaderItem {
  id: string;
  name: string;
  team: string;
  value: string;
  raw: number;
}

// 규정타석/이닝(주말리그 게임수 기준): 규정타석 = 경기수 × 3.1, 규정이닝 = 경기수 × 1.0.
// 팀 경기수를 모를 때를 대비한 최소 하한.
const PA_PER_GAME = 3.1;
const FALLBACK_MIN_AB = 5;
const FALLBACK_MIN_OUTS = 9;

function top(
  players: Player[],
  pick: (p: Player) => number | undefined,
  fmt: (n: number) => string,
  n = 5,
  asc = false,
  qualify: (p: Player) => boolean = () => true
): LeaderItem[] {
  return players
    .filter((p) => pick(p) != null && qualify(p))
    .map((p) => ({ id: p.id, name: p.name, team: p.team, raw: pick(p)! }))
    .sort((a, b) => (asc ? a.raw - b.raw : b.raw - a.raw))
    .slice(0, n)
    .map((x) => ({ ...x, value: fmt(x.raw) }));
}

const rate = (v: number) => (v < 1 ? v.toFixed(3).replace(/^0/, "") : v.toFixed(3));
const outsOf = (p: Player) => {
  const ip = p.pitching?.ip ?? 0;
  return Math.floor(ip) * 3 + Math.round((ip % 1) * 10);
};

export function leaderboards(players: Player[], teamGames?: Record<string, number>) {
  // 규정타석/이닝 자격: 팀 경기수 기반(없으면 하한)
  const reqPA = (p: Player) => {
    const g = teamGames?.[p.team];
    return g ? g * PA_PER_GAME : FALLBACK_MIN_AB;
  };
  const reqOuts = (p: Player) => {
    const g = teamGames?.[p.team];
    return g ? g * 3 : FALLBACK_MIN_OUTS; // 규정이닝 = 경기수 × 1.0 → 아웃 = ×3
  };
  const qualifyBat = (p: Player) => (p.batting?.pa ?? p.batting?.ab ?? 0) >= reqPA(p);
  const qualifyPit = (p: Player) => outsOf(p) >= reqOuts(p);
  return [
    {
      title: "타율 (규정타석)",
      items: top(players, (p) => p.batting?.avg, rate, 5, false, qualifyBat),
    },
    { title: "홈런", items: top(players, (p) => p.batting?.hr, (n) => String(n)) },
    { title: "타점", items: top(players, (p) => p.batting?.rbi, (n) => String(n)) },
    {
      title: "평균자책 (규정이닝)",
      items: top(players, (p) => p.pitching?.era, (n) => n.toFixed(2), 5, true, qualifyPit),
    },
    { title: "탈삼진", items: top(players, (p) => p.pitching?.so, (n) => String(n)) },
  ];
}
