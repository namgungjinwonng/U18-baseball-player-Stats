// 시합 셀렉터 계층화 — title 패턴으로 시합구분/상하반기/리그(권역) 파싱.
// 예) "2026 고교야구 주말리그 전반기(충청권)" → {kind:"주말리그", phase:"전반기", region:"충청권"}
// 예) "제80회 황금사자기 전국고교야구대회 겸 주말리그 왕중왕전" → {kind:"전국대회", region:undefined}
import type { TournamentEntry } from "./data";

export type Kind = "주말리그" | "전국대회";
export type Phase = "전반기" | "후반기";

export interface Categorized extends TournamentEntry {
  kind: Kind;
  phase?: Phase;
  region?: string; // 주말리그의 권역명 (괄호 안)
}

// 황금사자기 "겸 주말리그 왕중왕전" 같이 주말리그라는 단어가 포함되어도 전국대회로 분류.
function classifyKind(title: string): Kind {
  if (/주말리그\s*왕중왕전|전국고교야구대회|이마트배|황금사자기|청룡기|봉황대기|대통령배|협회장기/.test(title)) {
    return "전국대회";
  }
  if (/주말리그/.test(title)) return "주말리그";
  return "전국대회";
}

export function categorize(t: TournamentEntry): Categorized {
  const kind = classifyKind(t.title);
  if (kind === "전국대회") return { ...t, kind };
  const phase: Phase | undefined = /전반기/.test(t.title)
    ? "전반기"
    : /후반기/.test(t.title)
      ? "후반기"
      : undefined;
  const region = (t.title.match(/\(([^)]+)\)/) || [])[1];
  return { ...t, kind, phase, region };
}

export interface Tree {
  주말리그: {
    전반기: Categorized[];
    후반기: Categorized[];
  };
  전국대회: Categorized[];
}

export function buildTree(list: TournamentEntry[]): Tree {
  const tree: Tree = {
    주말리그: { 전반기: [], 후반기: [] },
    전국대회: [],
  };
  for (const t of list) {
    const c = categorize(t);
    if (c.kind === "주말리그" && c.phase) tree.주말리그[c.phase].push(c);
    else tree.전국대회.push(c);
  }
  // 가나다 정렬
  const sk = (a: Categorized, b: Categorized) =>
    (a.region ?? a.title).localeCompare(b.region ?? b.title, "ko");
  tree.주말리그.전반기.sort(sk);
  tree.주말리그.후반기.sort(sk);
  tree.전국대회.sort((a, b) => b.gameCount - a.gameCount);
  return tree;
}
