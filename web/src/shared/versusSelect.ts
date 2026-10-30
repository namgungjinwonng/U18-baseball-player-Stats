// 매치업 학교 선택 화면의 진입 판단·선택 상태 전이·확정 주소 계산 (순수 함수).
import { sameTeam, teamKey } from "./versus";

export type Slot = "a" | "b";

// 선택 중인 상태 — 확정 전까지 URL과 분리된다. 학교명은 teamKey로 정규화해 둔다.
export interface Draft {
  a: string;
  b: string;
  active: Slot; // 다음에 학교 카드를 누르면 채워질 칸
}

const other = (s: Slot): Slot => (s === "a" ? "b" : "a");

// 서로 다른 두 학교가 확정돼 있고 학교 변경 중이 아니면 결과 화면으로 바로 간다.
export function needsSelect(a: string, b: string, selectFlag: boolean): boolean {
  return selectFlag || !a.trim() || !b.trim() || sameTeam(a, b);
}

// 주소의 a·b로 선택 상태를 시작한다. 빈 칸(둘 다 차 있으면 B — 같은 학교 중복이면 B를 바꾸도록)을 활성화한다.
export function initialDraft(a: string, b: string): Draft {
  const da = a.trim() ? teamKey(a) : "";
  const db = b.trim() ? teamKey(b) : "";
  return { a: da, b: db, active: !da ? "a" : "b" };
}

// 학교 카드 선택. 반대 칸에 이미 있는 학교는 넣지 않는다(blocked).
// 활성 칸에 이미 그 학교가 있으면 그대로 둔다(다시 눌러도 해제되지 않는다).
export function pickTeam(d: Draft, team: string): { draft: Draft; blocked: boolean } {
  const name = teamKey(team);
  const opp = other(d.active);
  if (d[opp] && sameTeam(d[opp], name)) return { draft: d, blocked: true };
  if (d[d.active] && sameTeam(d[d.active], name)) return { draft: d, blocked: false };
  const next = { ...d, [d.active]: name };
  // 반대 칸이 비어 있으면 그쪽을 이어서 고르게 한다.
  return { draft: { ...next, active: next[opp] ? d.active : opp }, blocked: false };
}

export const activate = (d: Draft, slot: Slot): Draft => ({ ...d, active: slot });

// 한 칸 지우기 — 지운 칸을 다시 고를 수 있게 활성화한다.
export const clearSlot = (d: Draft, slot: Slot): Draft => ({ ...d, [slot]: "", active: slot });

// 좌우 교환. 한쪽만 차 있으면 빈 칸을 활성화하고, 둘 다 차 있으면 활성 칸 위치는 그대로 둔다.
export function swapDraft(d: Draft): Draft {
  const next = { a: d.b, b: d.a };
  const empty: Slot | null = !next.a ? "a" : !next.b ? "b" : null;
  return { ...next, active: empty ?? d.active };
}

export const canConfirm = (d: Draft) => !!d.a && !!d.b && !sameTeam(d.a, d.b);

// 「매치업 보기」 비활성 사유 안내.
export function missingMessage(d: Draft): string {
  if (!d.a && !d.b) return "우리팀과 상대팀을 선택해 주세요";
  if (!d.a) return "우리팀을 선택해 주세요";
  if (!d.b) return "상대팀을 선택해 주세요";
  if (sameTeam(d.a, d.b)) return "우리팀과 상대팀이 같은 학교입니다. 한 칸을 다른 학교로 바꿔 주세요";
  return "";
}

// 이전 조합에만 의미가 있는 결과 화면 상태 — 경기 강조(g), 타격 방향(m), 선수표 연도(py), 옛 대회(t).
const PAIR_PARAMS = ["g", "m", "py", "t"];

// 확정 주소의 검색어. 두 학교 조합이 바뀌면(순서만 바뀐 경우 제외) 조합 전용 상태를 지우고 탭(v)은 유지한다.
export function confirmParams(current: URLSearchParams, d: Draft): URLSearchParams {
  const next = new URLSearchParams(current);
  const prevA = current.get("a") ?? "";
  const prevB = current.get("b") ?? "";
  const samePair =
    !!prevA && !!prevB &&
    ((sameTeam(prevA, d.a) && sameTeam(prevB, d.b)) || (sameTeam(prevA, d.b) && sameTeam(prevB, d.a)));
  if (!samePair) for (const k of PAIR_PARAMS) next.delete(k);
  next.set("a", d.a);
  next.set("b", d.b);
  next.delete("select");
  return next;
}

// 결과 화면 → 학교 변경 화면 (현재 a·b와 결과 상태는 그대로 두고 select만 붙인다).
export function editParams(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("select", "1");
  return next;
}

// 학교 변경 취소 → 원래 결과 화면.
export function cancelParams(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete("select");
  return next;
}

// 학교 카드 목록 필터 — 지역 + 학교명 일부(앞뒤 공백·(U-18) 표기 차이 무시, 기존 teamKey 규칙).
export function filterTeams<T extends { name: string; region: string }>(list: T[], region: string, query: string): T[] {
  const q = teamKey(query).toLowerCase();
  return list.filter((t) => (!region || t.region === region) && (!q || teamKey(t.name).toLowerCase().includes(q)));
}
