// 타자/투수 기록 컬럼 정의.
// - 기본 탭: 카운팅 스탯(누적값) 만. 타율·ERA 같은 비율은 세부로 이동.
// - 세부 탭: 비율·세이버메트릭스 (타율·OBP·SLG·OPS·ISO·BABIP / ERA·WHIP·FIP·K9·BB9·H9·KBB).
import type { Column } from "./StatTable";
import type { Player } from "./types";
import { dec2, inn, rate } from "./format";
import { battingAdvanced, pitchingAdvanced, pct, dec1 } from "./sabermetrics";

const name: Column<Player> = {
  key: "name",
  label: "선수",
  value: (p) => p.name,
  defaultDesc: false,
};
const team: Column<Player> = {
  key: "team",
  label: "팀",
  value: (p) => p.team,
  defaultDesc: false,
};

// 타자 기본 — 카운팅 스탯만 (G, 타석, 타수, 안타, 2루타, 3루타, 홈런, 타점, 득점, 도루, 볼넷, 사구, 삼진)
export const battingBasicColumns: Column<Player>[] = [
  name,
  team,
  { key: "g", label: "G", value: (p) => p.batting?.g ?? 0 },
  { key: "pa", label: "타석", value: (p) => p.batting?.pa ?? 0 },
  { key: "ab", label: "타수", value: (p) => p.batting?.ab ?? 0 },
  { key: "h", label: "안타", value: (p) => p.batting?.h ?? 0 },
  { key: "b2", label: "2루타", value: (p) => p.batting?.b2 ?? 0 },
  { key: "b3", label: "3루타", value: (p) => p.batting?.b3 ?? 0 },
  { key: "hr", label: "홈런", value: (p) => p.batting?.hr ?? 0 },
  { key: "rbi", label: "타점", value: (p) => p.batting?.rbi ?? 0 },
  { key: "r", label: "득점", value: (p) => p.batting?.r ?? 0 },
  { key: "sb", label: "도루", value: (p) => p.batting?.sb ?? 0 },
  { key: "bb", label: "볼넷", value: (p) => p.batting?.bb ?? 0 },
  { key: "hbp", label: "사구", value: (p) => p.batting?.hbp ?? 0 },
  { key: "so", label: "삼진", value: (p) => p.batting?.so ?? 0 },
];

// 타자 세부 — 비율 + 세이버메트릭스 (타율, OBP, SLG, OPS, ISO, BABIP, BB%, K%, BB/K)
export const battingDetailColumns: Column<Player>[] = [
  name,
  team,
  { key: "g", label: "G", value: (p) => p.batting?.g ?? 0 },
  { key: "avg", label: "타율", value: (p) => p.batting?.avg ?? 0, render: (p) => rate(p.batting?.avg) },
  { key: "obp", label: "출루율", value: (p) => p.batting?.obp ?? 0, render: (p) => rate(p.batting?.obp) },
  { key: "slg", label: "장타율", value: (p) => p.batting?.slg ?? 0, render: (p) => rate(p.batting?.slg) },
  {
    key: "ops",
    label: "OPS",
    value: (p) => (p.batting ? p.batting.obp + p.batting.slg : 0),
    render: (p) => (p.batting ? rate(p.batting.obp + p.batting.slg) : "-"),
  },
  {
    key: "iso",
    label: "ISO",
    value: (p) => (p.batting ? battingAdvanced(p.batting).iso : 0),
    render: (p) => (p.batting ? rate(battingAdvanced(p.batting).iso) : "-"),
  },
  {
    key: "babip",
    label: "BABIP",
    value: (p) => (p.batting ? battingAdvanced(p.batting).babip : 0),
    render: (p) => (p.batting ? rate(battingAdvanced(p.batting).babip) : "-"),
  },
  {
    key: "bbPct",
    label: "BB%",
    value: (p) => (p.batting ? battingAdvanced(p.batting).bbPct : 0),
    render: (p) => (p.batting ? pct(battingAdvanced(p.batting).bbPct) : "-"),
  },
  {
    key: "kPct",
    label: "K%",
    value: (p) => (p.batting ? battingAdvanced(p.batting).kPct : 0),
    render: (p) => (p.batting ? pct(battingAdvanced(p.batting).kPct) : "-"),
  },
  {
    key: "bbK",
    label: "BB/K",
    value: (p) => (p.batting ? battingAdvanced(p.batting).bbK : 0),
    render: (p) => (p.batting ? dec2(battingAdvanced(p.batting).bbK) : "-"),
  },
];

// 투수 기본 — 카운팅 스탯만 (G, 승, 패, 세이브, 이닝, 피안타, 실점, 자책, 볼넷, 탈삼진)
export const pitchingBasicColumns: Column<Player>[] = [
  name,
  team,
  { key: "g", label: "G", value: (p) => p.pitching?.g ?? 0 },
  { key: "w", label: "승", value: (p) => p.pitching?.w ?? 0 },
  { key: "l", label: "패", value: (p) => p.pitching?.l ?? 0 },
  { key: "sv", label: "세이브", value: (p) => p.pitching?.sv ?? 0 },
  { key: "ip", label: "이닝", value: (p) => p.pitching?.ip ?? 0, render: (p) => inn(p.pitching?.ip) },
  { key: "h", label: "피안타", value: (p) => p.pitching?.h ?? 0 },
  { key: "r", label: "실점", value: (p) => p.pitching?.r ?? 0 },
  { key: "er", label: "자책", value: (p) => p.pitching?.er ?? 0 },
  { key: "bb", label: "볼넷", value: (p) => p.pitching?.bb ?? 0 },
  { key: "so", label: "탈삼진", value: (p) => p.pitching?.so ?? 0 },
];

// 투수 세부 — 비율 + 세이버메트릭스 (ERA, WHIP, FIP, K/9, BB/9, H/9, K/BB)
export const pitchingDetailColumns: Column<Player>[] = [
  name,
  team,
  { key: "g", label: "G", value: (p) => p.pitching?.g ?? 0 },
  { key: "era", label: "ERA", value: (p) => p.pitching?.era ?? 99, render: (p) => dec2(p.pitching?.era), defaultDesc: false },
  { key: "whip", label: "WHIP", value: (p) => p.pitching?.whip ?? 99, render: (p) => dec2(p.pitching?.whip), defaultDesc: false },
  {
    key: "fip",
    label: "FIP",
    value: (p) => (p.pitching ? pitchingAdvanced(p.pitching).fip ?? 99 : 99),
    render: (p) => {
      const f = p.pitching ? pitchingAdvanced(p.pitching).fip : undefined;
      return f != null ? dec2(f) : "-";
    },
    defaultDesc: false,
  },
  {
    key: "k9",
    label: "K/9",
    value: (p) => (p.pitching ? pitchingAdvanced(p.pitching).k9 : 0),
    render: (p) => (p.pitching ? dec1(pitchingAdvanced(p.pitching).k9) : "-"),
  },
  {
    key: "bb9",
    label: "BB/9",
    value: (p) => (p.pitching ? pitchingAdvanced(p.pitching).bb9 : 0),
    render: (p) => (p.pitching ? dec1(pitchingAdvanced(p.pitching).bb9) : "-"),
    defaultDesc: false,
  },
  {
    key: "h9",
    label: "H/9",
    value: (p) => (p.pitching ? pitchingAdvanced(p.pitching).h9 : 0),
    render: (p) => (p.pitching ? dec1(pitchingAdvanced(p.pitching).h9) : "-"),
    defaultDesc: false,
  },
  {
    key: "kbb",
    label: "K/BB",
    value: (p) => (p.pitching ? pitchingAdvanced(p.pitching).kbb : 0),
    render: (p) => (p.pitching ? dec2(pitchingAdvanced(p.pitching).kbb) : "-"),
  },
];

// 기록 탭 정의 (양 디바이스 공용)
export type RecordTab = {
  id: string;
  label: string;
  kind: "batting" | "pitching";
  columns: Column<Player>[];
  initialSort: string;
};

// 기본 정렬은 모두 경기수(g) 내림차순 — 표본이 많은 선수를 위에 노출.
export const recordTabs: RecordTab[] = [
  { id: "hit-basic", label: "타자 기본", kind: "batting", columns: battingBasicColumns, initialSort: "g" },
  { id: "hit-detail", label: "타자 세부", kind: "batting", columns: battingDetailColumns, initialSort: "g" },
  { id: "pit-basic", label: "투수 기본", kind: "pitching", columns: pitchingBasicColumns, initialSort: "g" },
  { id: "pit-detail", label: "투수 세부", kind: "pitching", columns: pitchingDetailColumns, initialSort: "g" },
];

export function filterByKind(players: Player[], kind: "batting" | "pitching") {
  return players.filter((p) => (kind === "batting" ? p.batting : p.pitching));
}
