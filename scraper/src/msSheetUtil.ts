// 기록지 판독값에서 합계가 맞는 시트만 고르고 앱 명단으로 이름을 확인해 선수별 중학교 기록을 만드는 순수 함수
export type BatRow = [name: string, pa: number, ab: number, h: number];
export type PitRow = [name: string, bf: number, h: number, so: number, r: number, er: number];
export interface Sheet {
  school: string; q: "A" | "B" | "C"; rows: BatRow[]; p: PitRow[];
  t: { pa: number; ab: number; r: number; h: number };
  pt: { bf: number; h: number; bb: number; so: number; r: number; er: number };
}
export interface Candidate { personNo: string; name: string }

const REGION = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*/;
export const normSchool = (s: string) => s.replace(REGION, "").replace(/중학교$/, "중").replace(/\s/g, "");
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// 타자 행 합이 시트 합계·KBSA 안타·득점과 모두 맞아야 쓴다.
export const battingVerified = (s: Sheet, kbsaHits: number, kbsaRuns: number) =>
  s.q !== "C" && sum(s.rows.map((r) => r[1])) === s.t.pa && sum(s.rows.map((r) => r[2])) === s.t.ab &&
  sum(s.rows.map((r) => r[3])) === s.t.h && s.t.h === kbsaHits && s.t.r === kbsaRuns;

// 투수 행 합이 시트 합계·상대 팀 KBSA 안타·삼진과 모두 맞아야 쓴다.
export const pitchingVerified = (s: Sheet, oppHits: number, oppSo: number) =>
  s.q !== "C" && sum(s.p.map((r) => r[1])) === s.pt.bf && sum(s.p.map((r) => r[2])) === s.pt.h &&
  sum(s.p.map((r) => r[3])) === s.pt.so && s.pt.h === oppHits && s.pt.so === oppSo;

// 같은 학교·연도 명단에 이름이 정확히 한 명일 때만 확인한다. 한 글자 교정은 다른 선수에게 기록을 붙일 수 있어 쓰지 않는다.
export function confirmName(name: string, roster: Candidate[]): string | null {
  const exact = roster.filter((c) => c.name === name);
  return exact.length === 1 ? exact[0].personNo : null;
}

// 한 시트에서 같은 선수가 두 행으로 연결되면 어느 행이 맞는지 알 수 없어 모두 뺀다.
export function assignRows<T extends [string, ...number[]]>(rows: T[], roster: Candidate[]) {
  const hits = rows.map((row) => ({ row, personNo: confirmName(row[0], roster) }));
  const count = new Map<string, number>();
  for (const h of hits) if (h.personNo) count.set(h.personNo, (count.get(h.personNo) ?? 0) + 1);
  return hits.filter((h) => h.personNo && count.get(h.personNo) === 1) as { row: T; personNo: string }[];
}

// KBSA 화면의 메뉴 문구가 앞에 붙은 대회 이름에서 대회명만 남긴다.
export const cleanLeague = (s: string) => s.replace(/^.*생활체육\s*/, "").trim();
