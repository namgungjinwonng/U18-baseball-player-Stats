// AI 경기분석 「분석 옵션」 — 선수 범위(학년·전학 간 선수 제외)와 경기 조건 설정(연습경기 선공은 AWAY 학교), 저장 키·요약 문구, 기록 필터·표본 계산
import type { Player, TeamRosterEntry } from "../types";
import { sameTeam, teamKey } from "../versus";

export type Grade = "1" | "2" | "3";
export const GRADES: Grade[] = ["3", "2", "1"];

export interface AiOptions {
  excludeMovedOut: boolean; // 다른 학교로 전학 간 선수 제외(전학 온 선수는 지금 학교 학년에 포함)
  excludeGrades: Grade[]; // 제외할 학년 — 분석에 쓰는 기록 연도의 학년 기준
  conditions: boolean; // 경기 조건(선공/후공·시간대·구장·날씨) 반영
  gameKind: "official" | "practice";
  gameIdx: string; // 공식경기: 일정 game_idx ("" = 고르지 않음)
  start: string; // 연습경기 시작 "YYYY-MM-DDTHH:mm" ("" = 모름)
  venue: string; // 연습경기 구장(야구장 현황 ID — kbsa:171·venue:목동야구장 등, "" = 모름 — 날씨 제외)
}

export const DEFAULT_OPTIONS: AiOptions = {
  excludeMovedOut: false, excludeGrades: [], conditions: false,
  gameKind: "official", gameIdx: "", start: "", venue: "",
};

export const scopeActive = (o: AiOptions) => o.excludeMovedOut || o.excludeGrades.length > 0;

// 저장 키 꼬리 — 기본값이면 빈 문자열이라 옵션 이전에 저장한 분석이 그대로 보인다.
export function optionsKey(o: AiOptions): string {
  const parts: string[] = [];
  if (o.excludeMovedOut) parts.push("moved");
  if (o.excludeGrades.length) parts.push(`g${[...o.excludeGrades].sort().join("")}`);
  if (o.conditions) parts.push(o.gameKind === "official" ? `c:o:${o.gameIdx}` : `c:p:${o.start}:${o.venue}`);
  return parts.join("|");
}

// 접힌 상태 한 줄 요약 — 예: "3학년·이적 제외 · 경기 조건 켜짐"
export function optionsSummary(o: AiOptions): string {
  const out = [...o.excludeGrades].sort().reverse().map((g) => `${g}학년`);
  if (o.excludeMovedOut) out.push("이적");
  return `${out.length ? `${out.join("·")} 제외` : "전체 선수"} · 경기 조건 ${o.conditions ? "켜짐" : "꺼짐"}`;
}

// 선수 범위 — 학년은 기록의 학년(그 기록 연도 기준), 전학 간 선수는 옛 학교 명단의 moved_to 항목으로 판단한다.
// 학년이 비어 있는 기록은 판단할 수 없어 남긴다.
export function filterRecords(records: Player[], teams: TeamRosterEntry[] | null | undefined, o: AiOptions): Player[] {
  if (!scopeActive(o)) return records;
  const moved = new Set<string>();
  if (o.excludeMovedOut) {
    for (const t of teams ?? []) for (const p of t.players) if (p.moved_to && p.person_no) moved.add(`${teamKey(t.team)}|${p.person_no}`);
  }
  const grades = new Set<string>(o.excludeGrades);
  return records.filter((p) => !(p.grade && grades.has(p.grade)) && !(p.personNo && moved.has(`${teamKey(p.team)}|${p.personNo}`)));
}

// 프롬프트 「선수범위」 — 무엇을 뺐고, 어떤 자료가 범위 적용/전체 선수 기준인지, 표본이 얼마나 줄었는지.
// recordYear = 학년을 판단한 기록 연도(시즌 초 참고 분석이면 전년도).
export function scopePayload(o: AiOptions, rows: SampleRow[], recordYear: number, reference: boolean) {
  const out: string[] = [...o.excludeGrades].sort().reverse().map((g) => `${g}학년`);
  if (o.excludeMovedOut) out.push("다른 학교로 전학 간 선수(전학 온 선수는 포함)");
  return {
    제외: out,
    학년기준: `${recordYear} 기록의 학년`,
    ...(reference
      ? { 적용자료: "주요선수(전년도 개인 기록)", 항상제외: "전년도 3학년(졸업)과 현재 엔트리에 없는 선수(전학 간 선수 포함)" }
      : { 적용자료: "팀지표(승률·강도지수 제외)·세부지표·주요선수·참고분석", 전체선수기준: "승률·강도지수·시즌전적·맞대결·공통상대·최근경기·최근흐름" }),
    표본: Object.fromEntries(rows.map((r) => [r.team, r.text])),
  };
}

const outsOf = (ip: number) => Math.floor(ip) * 3 + Math.round((ip % 1) * 10); // 6.2이닝 = 20아웃
const ipText = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ""}`;

export interface SampleRow { team: string; text: string } // 예: "타석 412 → 198 · 이닝 96 → 41"

// 옵션을 적용하면 분석할 자료가 없을 때 — 화면에 그대로 안내한다.
export class OptionsError extends Error {}
// 표본 경고 — 학교별 타석·이닝이 범위 적용 전후로 얼마나 줄었는지.
export function sampleRows(all: Player[], kept: Player[], teams: string[]): SampleRow[] {
  const sum = (rows: Player[], team: string) => {
    let pa = 0, outs = 0;
    for (const p of rows) {
      if (!sameTeam(p.team, team)) continue;
      pa += p.batting?.pa ?? 0;
      outs += p.pitching ? outsOf(p.pitching.ip) : 0;
    }
    return { pa, outs };
  };
  return teams.map((team) => {
    const a = sum(all, team), k = sum(kept, team);
    return { team, text: `타석 ${a.pa} → ${k.pa} · 이닝 ${ipText(a.outs)} → ${ipText(k.outs)}` };
  });
}
