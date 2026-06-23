// 홈 화면 리더보드 계산 (공용).
import type { Player } from "./types";

export interface LeaderItem {
  id: string;
  name: string;
  team: string;
  value: string;
  raw: number;
}

function top(
  players: Player[],
  pick: (p: Player) => number | undefined,
  fmt: (n: number) => string,
  n = 5,
  asc = false
): LeaderItem[] {
  return players
    .filter((p) => pick(p) != null)
    .map((p) => ({ id: p.id, name: p.name, team: p.team, raw: pick(p)! }))
    .sort((a, b) => (asc ? a.raw - b.raw : b.raw - a.raw))
    .slice(0, n)
    .map((x) => ({ ...x, value: fmt(x.raw) }));
}

const rate = (v: number) => (v < 1 ? v.toFixed(3).replace(/^0/, "") : v.toFixed(3));

export function leaderboards(players: Player[]) {
  return [
    { title: "타율", items: top(players, (p) => p.batting?.avg, rate) },
    { title: "홈런", items: top(players, (p) => p.batting?.hr, (n) => String(n)) },
    { title: "타점", items: top(players, (p) => p.batting?.rbi, (n) => String(n)) },
    {
      title: "평균자책",
      items: top(players, (p) => p.pitching?.era, (n) => n.toFixed(2), 5, true),
    },
    { title: "탈삼진", items: top(players, (p) => p.pitching?.so, (n) => String(n)) },
  ];
}
