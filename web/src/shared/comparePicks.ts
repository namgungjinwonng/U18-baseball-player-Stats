// 선수 비교 선택을 시즌과 무관하게 유지하는 순수 함수 — 시즌마다 바뀌는 선수 ID 대신 personNo로 다시 찾는다.

export interface PickRef {
  id: string; // 고른 시점 시즌의 선수 ID
  personNo?: string; // KBSA 고유번호 — 시즌이 바뀌어도 같은 선수
}

interface Candidate {
  id: string;
  personNo?: string;
}

const sameRef = (a: PickRef, b: Candidate) => a.id === b.id || (!!a.personNo && a.personNo === b.personNo);

// 고른 선수들을 현재 시즌 목록에서 다시 찾는다. 이 시즌에 기록이 없는 선수는 빠진다(중복도 제거).
export function resolvePicks<T extends Candidate>(picks: PickRef[], players: T[] | null | undefined): T[] {
  if (!players) return [];
  const out: T[] = [];
  for (const ref of picks) {
    const hit = players.find((p) => p.id === ref.id) ?? (ref.personNo ? players.find((p) => p.personNo === ref.personNo) : undefined);
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

// 선택 토글 — 이미 있으면 빼고, 꽉 찼으면 가장 먼저 고른 선수를 밀어낸다.
export function togglePickRef(picks: PickRef[], p: Candidate, max: number): PickRef[] {
  if (picks.some((ref) => sameRef(ref, p))) return picks.filter((ref) => !sameRef(ref, p));
  return [...picks, { id: p.id, personNo: p.personNo }].slice(-max);
}

// 비교 화면 주소 — 시즌이 바뀌어도 다시 찾을 수 있게 personNo(pn)를 같은 순서로 함께 싣는다.
export function compareHref(kind: string, players: Candidate[]): string {
  const ids = players.map((p) => encodeURIComponent(p.id)).join(",");
  const pns = players.map((p) => encodeURIComponent(p.personNo ?? "")).join(",");
  return `/compare?k=${kind}&ids=${ids}&pn=${pns}`;
}

// 비교 화면 주소의 선택을 PickRef 목록으로 (pn 없던 예전 주소도 그대로 읽힌다)
export function picksFromQuery(params: URLSearchParams, max: number): PickRef[] {
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, max);
  const pns = (params.get("pn") ?? "").split(",");
  return ids.map((id, i) => ({ id, personNo: pns[i] || undefined }));
}
