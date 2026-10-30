// 야구장 시·도 → 시·군·구 → 이름 검색 필터 — 야구장 현황과 경기분석 구장 선택이 같이 쓴다
import type { Field, FieldKind } from "./types";

export const SIDO_ORDER = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
export const FIELD_GROUPS: { kind: FieldKind; label: string }[] = [
  { kind: "고등학교", label: "고등학교 야구부" },
  { kind: "중학교", label: "중학교 야구부" },
  { kind: "대학교", label: "대학교 야구부" },
  { kind: "일반부", label: "일반부 팀" },
  { kind: "공식경기 구장", label: "공식경기 구장" },
  { kind: "프로야구장", label: "프로야구장" },
  { kind: "야구장", label: "일반·사회인·공원 야구장" },
];
export const kindRank = (k: FieldKind) => FIELD_GROUPS.findIndex((g) => g.kind === k);

export function sidoCounts(all: Field[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of all) m.set(f.sido, (m.get(f.sido) ?? 0) + 1);
  return m;
}
export const sidoOptions = (counts: Map<string, number>) => SIDO_ORDER.filter((s) => counts.has(s));

export function sigunguCounts(all: Field[], sido: string): [string, number][] {
  const m = new Map<string, number>();
  for (const f of all) if (f.sido === sido) m.set(f.sigungu, (m.get(f.sigungu) ?? 0) + 1);
  return [...m].sort((a, b) => a[0].localeCompare(b[0], "ko"));
}

// 시·도나 검색어가 없으면 빈 목록 — 전국 786곳을 한 번에 늘어놓지 않는다.
export function filterFields(all: Field[], sido: string, sgg: string, q: string): Field[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!sido && !words.length) return [];
  return all
    .filter((f) => (!sido || f.sido === sido) && (!sgg || f.sigungu === sgg))
    .filter((f) => words.every((w) => `${f.name} ${f.team ?? ""} ${f.sigungu} ${f.addr ?? ""}`.toLowerCase().includes(w)))
    .sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.sigungu.localeCompare(b.sigungu, "ko") || a.name.localeCompare(b.name, "ko"));
}
