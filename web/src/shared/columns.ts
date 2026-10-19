// 타자/투수 기록 컬럼 정의 — 열 묶음 프리셋 3종(기본/세부/세이버).
// - 기본: 카운팅 스탯(누적값)만.
// - 세부: 전통 비율 (타율·출루율·장타율·OPS / ERA·WHIP·H/9).
// - 세이버: 세이버메트릭스 (ISO·BABIP·BB%·K%·BB/K·wOBA·wRAA·wRC+·WAR / FIP·K/9·BB/9·K/BB·WAR).
//   비율 열은 리그평균(LeagueRates) 대비 색을 입히므로 세부·세이버 컬럼은 lg 를 받는 팩토리다.
import type { Column } from "./StatTable";
import type { LeagueRates, Player } from "./types";
import { dec2, inn, rate } from "./format";
import { battingAdvanced, pitchingAdvanced, pct, dec1, signed1, woba } from "./sabermetrics";
import { heatScore } from "./heat";

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
  align: "left", // 글자 열은 숫자 열과 달리 왼쪽 정렬
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

// 리그 평균 대비 색 — 선수 기록이 없거나 평균이 없으면 색 없음.
type RateKey = keyof LeagueRates;
const batHeat = (lg: LeagueRates | null | undefined, key: RateKey, of: (p: Player) => number | undefined, lowerIsBetter = false) =>
  (p: Player) => (p.batting && lg ? heatScore(of(p), lg[key], lowerIsBetter) : null);
const pitHeat = (lg: LeagueRates | null | undefined, key: RateKey, of: (p: Player) => number | undefined, lowerIsBetter = false) =>
  (p: Player) => (p.pitching && lg ? heatScore(of(p), lg[key], lowerIsBetter) : null);

const batG: Column<Player> = { key: "g", label: "G", value: (p) => p.batting?.g ?? 0 };
const batPa: Column<Player> = { key: "pa", label: "타석", value: (p) => p.batting?.pa ?? 0 };
const opsOf = (p: Player) => (p.batting ? p.batting.obp + p.batting.slg : undefined);

// 타자 세부 — 전통 비율 (타율, 출루율, 장타율, OPS)
export function battingRateColumns(lg?: LeagueRates | null): Column<Player>[] {
  return [
    name,
    team,
    batG,
    batPa,
    { key: "avg", label: "타율", value: (p) => p.batting?.avg ?? 0, render: (p) => rate(p.batting?.avg), heat: batHeat(lg, "avg", (p) => p.batting?.avg) },
    { key: "obp", label: "출루율", value: (p) => p.batting?.obp ?? 0, render: (p) => rate(p.batting?.obp), heat: batHeat(lg, "obp", (p) => p.batting?.obp) },
    { key: "slg", label: "장타율", value: (p) => p.batting?.slg ?? 0, render: (p) => rate(p.batting?.slg), heat: batHeat(lg, "slg", (p) => p.batting?.slg) },
    {
      key: "ops",
      label: "OPS",
      value: (p) => opsOf(p) ?? 0,
      render: (p) => (p.batting ? rate(opsOf(p)) : "-"),
      heat: batHeat(lg, "ops", opsOf),
    },
  ];
}

// 타자 세이버 — ISO, BABIP, BB%, K%, BB/K, wOBA, wRAA, wRC+, WAR
export function battingSaberColumns(lg?: LeagueRates | null): Column<Player>[] {
  const adv = (p: Player) => (p.batting ? battingAdvanced(p.batting, lg) : undefined);
  return [
    name,
    team,
    batG,
    batPa,
    {
      key: "iso",
      label: "ISO",
      value: (p) => adv(p)?.iso ?? 0,
      render: (p) => rate(adv(p)?.iso),
      heat: batHeat(lg, "iso", (p) => adv(p)?.iso),
    },
    {
      key: "babip",
      label: "BABIP",
      value: (p) => adv(p)?.babip ?? 0,
      render: (p) => rate(adv(p)?.babip),
      heat: batHeat(lg, "babip", (p) => adv(p)?.babip),
    },
    {
      key: "bbPct",
      label: "BB%",
      value: (p) => adv(p)?.bbPct ?? 0,
      render: (p) => {
        const v = adv(p)?.bbPct;
        return v != null ? pct(v) : "-";
      },
      heat: batHeat(lg, "bbPct", (p) => adv(p)?.bbPct),
    },
    {
      key: "kPct",
      label: "K%",
      value: (p) => adv(p)?.kPct ?? 0,
      render: (p) => {
        const v = adv(p)?.kPct;
        return v != null ? pct(v) : "-";
      },
      defaultDesc: false,
      heat: batHeat(lg, "kPct", (p) => adv(p)?.kPct, true),
    },
    {
      key: "bbK",
      label: "BB/K",
      value: (p) => adv(p)?.bbK ?? 0,
      render: (p) => dec2(adv(p)?.bbK),
      heat: batHeat(lg, "bbK", (p) => adv(p)?.bbK),
    },
    {
      key: "woba",
      label: "wOBA",
      value: (p) => (p.batting ? woba(p.batting) : 0),
      render: (p) => (p.batting ? rate(woba(p.batting)) : "-"),
      heat: batHeat(lg, "woba", (p) => (p.batting ? woba(p.batting) : undefined)),
    },
    {
      key: "wraa",
      label: "wRAA",
      value: (p) => adv(p)?.wraa ?? 0,
      render: (p) => {
        const v = adv(p)?.wraa;
        return v != null ? signed1(v) : "-";
      },
    },
    {
      key: "wrc",
      label: "wRC+",
      value: (p) => adv(p)?.wrcPlus ?? 0,
      render: (p) => {
        const v = adv(p)?.wrcPlus;
        return v != null ? String(v) : "-";
      },
      // wRC+ 는 리그 평균이 100으로 고정된 지표
      heat: (p) => heatScore(adv(p)?.wrcPlus, 100),
    },
    {
      key: "war",
      label: "WAR",
      value: (p) => adv(p)?.war ?? 0,
      render: (p) => {
        const v = adv(p)?.war;
        return v != null ? dec1(v) : "-";
      },
    },
  ];
}

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

const pitG: Column<Player> = { key: "g", label: "G", value: (p) => p.pitching?.g ?? 0 };
const pitIp: Column<Player> = { key: "ip", label: "이닝", value: (p) => p.pitching?.ip ?? 0, render: (p) => inn(p.pitching?.ip) };

// 투수 세부 — 전통 비율 (ERA, WHIP, H/9)
export function pitchingRateColumns(lg?: LeagueRates | null): Column<Player>[] {
  const adv = (p: Player) => (p.pitching ? pitchingAdvanced(p.pitching, lg) : undefined);
  return [
    name,
    team,
    pitG,
    pitIp,
    {
      key: "era", label: "ERA", value: (p) => p.pitching?.era ?? 99, render: (p) => dec2(p.pitching?.era), defaultDesc: false,
      heat: pitHeat(lg, "era", (p) => p.pitching?.era, true),
    },
    {
      key: "whip", label: "WHIP", value: (p) => p.pitching?.whip ?? 99, render: (p) => dec2(p.pitching?.whip), defaultDesc: false,
      heat: pitHeat(lg, "whip", (p) => p.pitching?.whip, true),
    },
    {
      key: "h9",
      label: "H/9",
      value: (p) => adv(p)?.h9 ?? 0,
      render: (p) => {
        const v = adv(p)?.h9;
        return v != null ? dec1(v) : "-";
      },
      defaultDesc: false,
      heat: pitHeat(lg, "h9", (p) => adv(p)?.h9, true),
    },
  ];
}

// 투수 세이버 — FIP, K/9, BB/9, K/BB, WAR
export function pitchingSaberColumns(lg?: LeagueRates | null): Column<Player>[] {
  const adv = (p: Player) => (p.pitching ? pitchingAdvanced(p.pitching, lg) : undefined);
  return [
    name,
    team,
    pitG,
    pitIp,
    {
      key: "fip",
      label: "FIP",
      value: (p) => adv(p)?.fip ?? 99,
      render: (p) => dec2(adv(p)?.fip),
      defaultDesc: false,
      heat: pitHeat(lg, "fip", (p) => adv(p)?.fip, true),
    },
    {
      key: "k9",
      label: "K/9",
      value: (p) => adv(p)?.k9 ?? 0,
      render: (p) => {
        const v = adv(p)?.k9;
        return v != null ? dec1(v) : "-";
      },
      heat: pitHeat(lg, "k9", (p) => adv(p)?.k9),
    },
    {
      key: "bb9",
      label: "BB/9",
      value: (p) => adv(p)?.bb9 ?? 0,
      render: (p) => {
        const v = adv(p)?.bb9;
        return v != null ? dec1(v) : "-";
      },
      defaultDesc: false,
      heat: pitHeat(lg, "bb9", (p) => adv(p)?.bb9, true),
    },
    {
      key: "kbb",
      label: "K/BB",
      value: (p) => adv(p)?.kbb ?? 0,
      render: (p) => dec2(adv(p)?.kbb),
      heat: pitHeat(lg, "kbb", (p) => adv(p)?.kbb),
    },
    {
      key: "war",
      label: "WAR",
      value: (p) => adv(p)?.war ?? 0,
      render: (p) => {
        const v = adv(p)?.war;
        return v != null ? dec1(v) : "-";
      },
    },
  ];
}

// 기록 탭 정의 (양 디바이스 공용) — 종류(타자/투수) × 프리셋(기본/세부/세이버)
export type RecordKind = "batting" | "pitching";
export type RecordPreset = "basic" | "rate" | "saber";
export const RECORD_KINDS: { id: RecordKind; label: string }[] = [
  { id: "batting", label: "타자" },
  { id: "pitching", label: "투수" },
];
export const RECORD_PRESETS: { id: RecordPreset; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "rate", label: "세부" },
  { id: "saber", label: "세이버" },
];
export type RecordTab = {
  id: string;
  label: string;
  kind: RecordKind;
  preset: RecordPreset;
  columns: Column<Player>[];
  initialSort: string;
};

// 기본 정렬은 타자=타석(pa), 투수=이닝(ip) 내림차순 — 실제 출전량이 많은 선수를 위에 노출.
// 세부·세이버는 리그평균 대비 색과 wRC+/WAR 계산에 lg(스코프에 맞는 LeagueRates)를 쓴다.
export function recordTabs(lg?: LeagueRates | null): RecordTab[] {
  return [
    { id: "batting-basic", label: "타자 기본", kind: "batting", preset: "basic", columns: battingBasicColumns, initialSort: "pa" },
    { id: "batting-rate", label: "타자 세부", kind: "batting", preset: "rate", columns: battingRateColumns(lg), initialSort: "pa" },
    { id: "batting-saber", label: "타자 세이버", kind: "batting", preset: "saber", columns: battingSaberColumns(lg), initialSort: "pa" },
    { id: "pitching-basic", label: "투수 기본", kind: "pitching", preset: "basic", columns: pitchingBasicColumns, initialSort: "ip" },
    { id: "pitching-rate", label: "투수 세부", kind: "pitching", preset: "rate", columns: pitchingRateColumns(lg), initialSort: "ip" },
    { id: "pitching-saber", label: "투수 세이버", kind: "pitching", preset: "saber", columns: pitchingSaberColumns(lg), initialSort: "ip" },
  ];
}

export function filterByKind(players: Player[], kind: "batting" | "pitching") {
  return players.filter((p) => (kind === "batting" ? p.batting : p.pitching));
}
