// U18 팀 로스터 수집 — 학년/person_no/포지션/투타 보강용.
// 박스스코어(record_detail)에는 이름·등번호만 있어 동명이인 구분/학년이 없으므로,
// 팀 선수명단에서 (이름,등번호) 키로 조인해 오버레이한다.
//
//  - 팀 목록: GET /info/team/team_list?kind_cd=31&page=N
//  - 팀 선수: GET /info/team/team_player?club_idx=X&kind_cd=31
//
// 실행: npm run roster  → data/roster.json 갱신 (로스터는 자주 안 변하므로 가끔 실행)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, KIND } from "./koreaBaseball.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export interface RosterEntry {
  team?: string; // 정식 팀명(박스스코어 축약명 보정용)
  grade?: string; // 1/2/3
  position?: string;
  bats?: string;
  throws?: string;
  personNo?: string;
  region?: string; // 지역(서울/경기 등)
  clubIdx?: string; // 공식 기록 조회용 팀 ID
}
// 키: `${이름}|${등번호}` → 항목 배열.
// (다른 학교에 동일 이름·번호 선수가 있을 수 있어 충돌 보존을 위해 배열로 저장한다.)
export type Roster = Record<string, RosterEntry[]>;

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (U18 roster sync)" } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

async function fetchTeams(
  kindCd: number
): Promise<{ clubIdx: string; name: string; region: string }[]> {
  const teams: { clubIdx: string; name: string; region: string }[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 30; page++) {
    const html = await get(`${BASE}/info/team/team_list?kind_cd=${kindCd}&page=${page}`);
    // "team_player?club_idx=" 기준으로 팀 블록 분할 후 각 블록에서 추출
    const chunks = html.split("team_player?club_idx=").slice(1);
    if (chunks.length === 0) break;
    let added = 0;
    for (const chunk of chunks) {
      const clubIdx = (chunk.match(/^(\d+)/) || [])[1];
      if (!clubIdx || seen.has(clubIdx)) continue;
      seen.add(clubIdx);
      const name = stripTags((chunk.match(/>([\s\S]*?)<\/a>/) || [])[1] ?? "");
      const region = (stripTags(chunk.slice(0, 500)).match(/지역\s*([가-힣]+)/) || [])[1] ?? "";
      if (name) teams.push({ clubIdx, name, region });
      added++;
    }
    if (added === 0) break;
  }
  return teams;
}

// 정규화: "1 학년" → "1"
const grade = (t: string) => (t.match(/(\d+)\s*학년/) || [])[1] ?? "";
// 투타: "우투우타" → throws 우, bats 우
function throwBat(t: string): { throws?: string; bats?: string } {
  const m = t.match(/([좌우양])투([좌우양])타/);
  return m ? { throws: m[1], bats: m[2] } : {};
}

async function fetchTeamRoster(
  clubIdx: string, teamName: string, region: string, roster: Roster
): Promise<number> {
  const html = await get(`${BASE}/info/team/team_player?club_idx=${clubIdx}&kind_cd=${KIND.U18}`);
  // 선수 항목 단위로 파싱 (dl/dt/dd 구조)
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  let count = 0;
  for (const li of items) {
    const gradeRaw = (li.match(/<dt>\s*학년\s*<\/dt>\s*<dd>([^<]+)/i) || [])[1];
    if (!gradeRaw) continue; // 학년이 있는 항목만 = 선수(지도자 제외)
    const number = (li.match(/<span class="number">\s*(\d+)/i) || [])[1];
    const name = stripTags((li.match(/<span class="name">\s*<a[^>]*>([^<]+)<\/a>/i) || [])[1] ?? "");
    if (!name || !number) continue;
    const personNo = (li.match(/person_no=(\d+)/) || [])[1];
    const position = stripTags((li.match(/<dt>\s*선수구분\s*<\/dt>[\s\S]*?<dd>([^<]+)/i) || [])[1] ?? "");
    const tb = (li.match(/<dt>\s*투타\s*<\/dt>\s*<dd>([^<]+)/i) || [])[1] ?? "";
    const key = `${name}|${number}`;
    const entry: RosterEntry = {
      team: teamName,
      region: region || undefined,
      clubIdx,
      grade: grade(gradeRaw),
      position: position || undefined,
      personNo,
      ...throwBat(tb),
    };
    // 같은 이름·번호가 여러 학교에 있을 수 있어 배열로 누적(같은 personNo 중복은 제외).
    const arr = roster[key] ?? (roster[key] = []);
    if (!arr.some((e) => e.personNo === entry.personNo)) arr.push(entry);
    count++;
  }
  return count;
}

async function main() {
  const limit = process.env.TEAM_LIMIT ? parseInt(process.env.TEAM_LIMIT, 10) : Infinity;
  const teams = await fetchTeams(KIND.U18);
  console.log(`팀 ${teams.length}개 발견. 로스터 수집…`);
  const roster: Roster = {};
  let done = 0;
  for (const t of teams) {
    if (done >= limit) break;
    try {
      const n = await fetchTeamRoster(t.clubIdx, t.name, t.region, roster);
      done++;
      if (done % 20 === 0) console.log(`  …${done}팀 (${Object.keys(roster).length}명)`);
      void n;
    } catch (e) {
      console.warn(`  ⚠ ${t.name}(${t.clubIdx}) 실패: ${(e as Error).message}`);
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, "roster.json"), JSON.stringify(roster, null, 2) + "\n");
  console.log(`✓ 로스터 ${Object.keys(roster).length}명 → data/roster.json (${done}팀)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
