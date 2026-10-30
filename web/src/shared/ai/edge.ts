// 강도지수(타격·마운드)로 두 학교의 「기록 기반 예상 우위」를 5:5~8:2 구간으로 계산한다 — AI는 이 비율을 설명만 한다
import type { TeamStrength } from "../types";
import { teamKey } from "../versus";

// 우위 쪽 기대 승률 = 1 / (1 + (B 전력 / A 전력)^K), 전력 = 타격 지수 × 마운드 지수.
// K는 2024~2026 공식경기 2,883경기에 최대우도로 맞춘 값(시즌을 하나씩 뺀 교차 적합도 7.3~7.8로 안정).
export const EDGE_K = 7.45;
// 같은 경기로 확인한 구간별 우위 쪽 실제 승률(aiOptions.test.ts 가 현재 자료로 다시 계산해 크게 어긋나면 실패한다).
// 강도지수가 같은 시즌 기록으로 만들어져 실제 예측력은 이보다 낮을 수 있어, 8:2를 넘는 차이는 「8:2 이상」으로 묶는다.
export const EDGE_BANDS = [
  { label: "5:5", max: 0.55, games: 236, favWin: 0.445 },
  { label: "6:4", max: 0.65, games: 453, favWin: 0.556 },
  { label: "7:3", max: 0.75, games: 493, favWin: 0.706 },
  { label: "8:2 이상", max: 1.01, games: 1701, favWin: 0.892 },
] as const;
export const EDGE_SAMPLE_GAMES = 10; // 이 경기 수 미만인 학교는 강도지수가 지역 평균 쪽으로 많이 당겨져 있다
export const HOME_WIN_NOTE = "선공(원정) 학교 승률이 49.7%로 선공/후공 차이가 없어 비율에 반영하지 않았다";

export const edgeProb = (a: TeamStrength, b: TeamStrength) => 1 / (1 + ((b.bat * b.pit) / (a.bat * a.pit)) ** EDGE_K);
export const edgeBand = (p: number) => EDGE_BANDS.find((x) => Math.max(p, 1 - p) < x.max)!;

const pctText = (n: number) => `${(n * 100).toFixed(1)}%`;

// 부호 있는 구간 — +면 A 우위, -면 B 우위, 0은 동등. 1=6:4, 2=7:3, 3=8:2(이상).
export const RATIOS = ["5:5", "6:4", "7:3", "8:2"] as const;
const signedOf = (p: number) => { const i = EDGE_BANDS.indexOf(edgeBand(p)); return p >= 0.5 ? i : -i; };
export const edgeLabel = (signed: number, aName: string, bName: string) =>
  signed === 0 ? "동등 5:5" : `${signed > 0 ? aName : bName} 우위 ${Math.abs(signed) >= 3 ? "8:2 이상" : RATIOS[Math.abs(signed)]}`;
// "강릉고 우위 7:3" · "동등 5:5" → 부호 있는 구간
export function parseEdgeLabel(label: string, aName: string): number | null {
  const m = label.match(/(?<!\d)([5-8]):([2-5])(?!\d)/);
  const i = m ? RATIOS.indexOf(`${m[1]}:${m[2]}` as (typeof RATIOS)[number]) : -1;
  if (i < 0) return null;
  return i === 0 ? 0 : label.includes(aName) ? i : -i;
}
// 프롬프트 「예상우위」 — 강도지수가 없는 학교가 있으면 null(비율을 지어내지 않는다).
export function edgePayload(teams: Record<string, TeamStrength> | null | undefined, aName: string, bName: string) {
  const find = (name: string) => Object.entries(teams ?? {}).find(([k]) => teamKey(k) === teamKey(name))?.[1];
  const a = find(aName), b = find(bName);
  if (!a || !b) return null;
  const p = edgeProb(a, b), band = edgeBand(p), signed = signedOf(p);
  const range = [signed - 1, signed + 1].map((x) => Math.max(-3, Math.min(3, x)));
  const few = [[aName, a], [bName, b]].filter(([, s]) => (s as TeamStrength).g < EDGE_SAMPLE_GAMES).map(([n]) => n as string);
  return {
    결과: edgeLabel(signed, aName, bName),
    조정범위: `${edgeLabel(range[0], aName, bName)} ~ ${edgeLabel(range[1], aName, bName)}`,
    근거: {
      [aName]: `강도지수 타격 ${a.bat.toFixed(2)} · 마운드 ${a.pit.toFixed(2)} (${a.g}경기)`,
      [bName]: `강도지수 타격 ${b.bat.toFixed(2)} · 마운드 ${b.pit.toFixed(2)} (${b.g}경기)`,
    },
    검증: `2024~2026 공식경기에서 이 구간(${band.label}) ${band.games}경기의 우위 쪽 실제 승률 ${pctText(band.favWin)}. 같은 시즌 기록으로 계산한 값이라 실제 예측력은 이보다 낮을 수 있다.`,
    안내: `강도지수(상대 수준 보정 타격·마운드)로만 계산한 시즌 전체 기준 비율이다. ${HOME_WIN_NOTE}. 날씨·시간대·선수 범위는 비율에 넣지 않았다.`,
    ...(few.length ? { 표본주의: `${few.join("·")}은(는) ${EDGE_SAMPLE_GAMES}경기 미만이라 비율이 불안정하다` } : {}),
  };
}

// 화면 표시(AWAY·HOME 기준 분석) — 「강릉고 우위 7:3」 → 「우리팀 강릉고 우위 7:3」
export const perspectiveLabel = (label: string, ourName: string, oppName: string) =>
  label.startsWith(`${ourName} `) ? `우리팀 ${label}` : label.startsWith(`${oppName} `) ? `상대팀 ${label}` : label;

// AI 응답 검사 — 우위·동등·판단을 말하는 문장의 비율은 기준에서 한 구간 안이어야 한다. 벗어나면 그 문장을 버린다.
// 맞대결 점수(예: 6:4 승리)는 우위 표현이 없는 문장이라 검사하지 않는다.
const EDGE_WORDS = /우위|동등|판단/;
// 합이 10인 「a:b」만 비율로 본다(5:3 같은 점수는 비율이 아님). 9:1·4:6처럼 정해진 표기가 아니면 버린다.
const RATIO_RE = /(?<!\d)(\d):(\d)(?!\d)/g;
// ours = AWAY·HOME 기준 분석에서 「우리팀」이 가리키는 쪽(a = A 학교, b = B 학교). 양팀 비교는 없음.
export function checkEdgeLines(lines: string[], aName: string, bName: string, base: number, ours?: "a" | "b") {
  const aAlias = ours === "a" ? "우리팀" : ours === "b" ? "상대팀" : null;
  const bAlias = ours === "a" ? "상대팀" : ours === "b" ? "우리팀" : null;
  const lastAt = (s: string, name: string, alias: string | null) => Math.max(s.lastIndexOf(name), alias ? s.lastIndexOf(alias) : -1);
  const kept: string[] = [], dropped: string[] = [];
  let adjusted: number | undefined;
  for (const line of lines) {
    if (!EDGE_WORDS.test(line)) { kept.push(line); continue; }
    let ok = true;
    for (const m of line.matchAll(RATIO_RE)) {
      if (+m[1] + +m[2] !== 10) continue;
      const i = RATIOS.indexOf(`${m[1]}:${m[2]}` as (typeof RATIOS)[number]);
      if (i < 0) { ok = false; break; }
      // 비율 앞에서 가장 가까이 나온 학교(또는 그 학교를 가리키는 「우리팀」·「상대팀」)가 우위 쪽. 없으면 기준과 같은 쪽으로 본다.
      const before = line.slice(0, m.index);
      const atA = lastAt(before, aName, aAlias);
      const atB = lastAt(before, bName, bAlias);
      const side = i === 0 ? 0 : atA < 0 && atB < 0 ? Math.sign(base) || 1 : atA > atB ? 1 : -1;
      const signed = side * i;
      if (Math.abs(signed - base) > 1) { ok = false; break; }
      if (signed !== base && adjusted === undefined) adjusted = signed;
    }
    (ok ? kept : dropped).push(line);
  }
  return { kept, dropped, adjusted: adjusted === undefined ? undefined : edgeLabel(adjusted, aName, bName) };
}
