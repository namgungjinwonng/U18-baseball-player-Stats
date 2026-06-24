// 홈 화면 리더보드 계산 (공용).
import type { Player } from "./types";

export interface LeaderItem {
  id: string;
  name: string;
  team: string;
  value: string;
  raw: number;
}

// 비율 기록(타율/평균자책)은 소표본 왜곡을 막기 위한 규정 타석/이닝 필터를 둔다.
const MIN_AB = 5; // 타율 자격 최소 타수
const MIN_OUTS = 9; // 평균자책 자격 최소 아웃(=3이닝)

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

export function leaderboards(players: Player[]) {
  return [
    {
      title: `타율 (${MIN_AB}타수↑)`,
      items: top(players, (p) => p.batting?.avg, rate, 5, false, (p) => (p.batting?.ab ?? 0) >= MIN_AB),
    },
    { title: "홈런", items: top(players, (p) => p.batting?.hr, (n) => String(n)) },
    { title: "타점", items: top(players, (p) => p.batting?.rbi, (n) => String(n)) },
    {
      title: "평균자책 (3이닝↑)",
      items: top(players, (p) => p.pitching?.era, (n) => n.toFixed(2), 5, true, (p) => outsOf(p) >= MIN_OUTS),
    },
    { title: "탈삼진", items: top(players, (p) => p.pitching?.so, (n) => String(n)) },
  ];
}
