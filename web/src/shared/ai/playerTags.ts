// 경기분석 문장 속 선수 이름 뒤에 「(2학년, 우투좌타)」를 붙이기 위한 이름표 만들기와 문장 나누기
import { batsThrowsLabel } from "../matchup";
import { sameTeam } from "../versus";

export interface PlayerTagSource { name: string; team: string; grade?: string; bats?: string; throws?: string }
export type PlayerTags = Map<string, string>;
export type TagSegment = string | { name: string; tag: string };

// 두 학교 선수 이름 → 「2학년, 우투좌타」. 같은 이름인데 정보가 다르면(동명이인) 누구인지 몰라 붙이지 않는다.
export function playerTags(players: PlayerTagSource[], teams: string[]): PlayerTags {
  const seen = new Map<string, string | null>();
  for (const p of players) {
    if (!teams.some((t) => sameTeam(p.team, t))) continue;
    const tag = [p.grade ? `${p.grade}학년` : "", batsThrowsLabel(p)].filter(Boolean).join(", ");
    if (!tag) continue;
    const prev = seen.get(p.name);
    seen.set(p.name, prev === undefined || prev === tag ? tag : null);
  }
  return new Map([...seen].filter((e): e is [string, string] => e[1] !== null));
}

const HANGUL = /[가-힣]/;

// 한 줄에서 선수마다 첫 언급에만 이름표를 붙인다. 앞 글자가 한글이면 다른 낱말의 일부라 건너뛰고,
// 긴 이름부터 찾아 겹치지 않게 하며, 바로 뒤에 괄호가 있으면(이미 설명이 붙음) 붙이지 않는다.
export function tagPlayers(text: string, tags: PlayerTags): TagSegment[] {
  const hits: { start: number; end: number; name: string }[] = [];
  for (const name of [...tags.keys()].sort((x, y) => y.length - x.length)) {
    for (let i = text.indexOf(name); i >= 0; i = text.indexOf(name, i + 1)) {
      const end = i + name.length;
      if (i > 0 && HANGUL.test(text[i - 1])) continue;
      if (text[end] === "(" || text.startsWith(" (", end)) break;
      if (hits.some((h) => i < h.end && end > h.start)) continue;
      hits.push({ start: i, end, name });
      break;
    }
  }
  if (!hits.length) return [text];
  hits.sort((x, y) => x.start - y.start);
  const out: TagSegment[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start > at) out.push(text.slice(at, h.start));
    out.push({ name: h.name, tag: tags.get(h.name)! });
    at = h.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
