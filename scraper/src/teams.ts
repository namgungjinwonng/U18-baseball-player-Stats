// KBSA U18 팀·선수현황 수집기 — 선수현황 페이지용 data/{year}/teams.json 생성.
// 이식 원본: u81-baseball/fetch_u18_rosters.py (팀 목록(감독 포함) → 팀별 선수/지도자).
// roster.ts(집계 조인용 roster.json)와 소스는 같지만 산출물 목적이 다르다:
// teams.json 은 프론트가 직접 읽는 뷰 모델(팀 카드/지도자/신장·체중 포함, dist 포함).
//
// 실행: npm run teams  → data/{year}/teams.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, KIND } from "./koreaBaseball.js";
import type { TeamPlayerEntry, TeamRosterEntry, TeamStaffEntry } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

// 시즌 = 실행 시점의 KST 연도 (fetch_u18_rosters.py 와 동일 기준)
export const kstYear = (): number =>
  new Date(Date.now() + 9 * 3600 * 1000).getUTCFullYear();

// 주석 제거: 정규식 캡처 구간이 주석 중간에서 잘리면 "-->"/"<!--" 파편이 남으므로 함께 제거.
const stripComments = (s: string) =>
  s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<!--|-->/g, " ");
const stripTags = (s: string) =>
  stripComments(s).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// 일시 오류 재시도 — roster.ts 와 동일한 지수 백오프 5회.
async function get(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(3000 * 2 ** (attempt - 1), 20000)));
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (U18 teams sync)" } });
      if (res.status >= 500) throw new Error(`GET ${url} → ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`GET ${url} → ${res.status}`), { permanent: true });
      return res.text();
    } catch (e) {
      if ((e as { permanent?: boolean }).permanent) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

interface TeamRef { clubIdx: string; name: string; region: string; manager: string }

// 팀 목록(감독 포함) — team_list 페이지를 빈 페이지가 나올 때까지 순회.
async function fetchTeams(season: number): Promise<TeamRef[]> {
  const teams: TeamRef[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 30; page++) {
    const html = await get(`${BASE}/info/team/team_list?kind_cd=${KIND.U18}&season=${season}&page=${page}`);
    const chunks = html.split("team_player?club_idx=").slice(1);
    if (chunks.length === 0) break;
    let added = 0;
    for (const chunk of chunks) {
      const clubIdx = (chunk.match(/^(\d+)/) || [])[1];
      if (!clubIdx || seen.has(clubIdx)) continue;
      seen.add(clubIdx);
      const name = stripTags((chunk.match(/>([\s\S]*?)<\/a>/) || [])[1] ?? "");
      // 팀 카드의 dt/dd 필드(지역·감독)는 같은 dl 안에 있으므로 </dl> 전까지만 검사
      const card = chunk.slice(0, chunk.indexOf("</dl>") + 1 || undefined);
      const dlField = (label: string): string =>
        stripTags((card.match(new RegExp(`<dt[^>]*>\\s*${label}\\s*<\\/dt>\\s*(?:<!--[\\s\\S]*?-->\\s*)*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i")) || [])[1] ?? "");
      const region = dlField("지역");
      const manager = dlField("감독");
      if (name) teams.push({ clubIdx, name, region, manager });
      added++;
    }
    if (added === 0) break;
  }
  return teams;
}

// 세부 포지션 → 5개 주요 카테고리 (fetch_u18_rosters.py POSITION_MAP 동일)
const POSITION_MAP: Record<string, string> = {
  유격수: "내야수", "1루수": "내야수", "2루수": "내야수", "3루수": "내야수",
  중견수: "외야수", 우익수: "외야수", 좌익수: "외야수",
};
const normalizePosition = (pos: string) => (pos ? POSITION_MAP[pos] ?? pos : "");

// "182cm /   80                kg" → "182cm / 80kg"
function normalizeHw(text: string): string {
  if (!text) return "";
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/(\d)\s*kg/g, "$1kg").replace(/(\d)\s*cm/g, "$1cm");
  t = t.replace(/\s*\/\s*/g, " / ");
  return t.trim();
}

// "1                학년" → "1"
function normalizeGrade(text: string): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return (t.match(/(\d+)\s*학년/) || t.match(/(\d+)/) || [])[1] ?? "";
}

// li 하나 파싱 → 선수 또는 지도자 (fetch_u18_rosters.py parse_player_li 이식)
function parsePlayerLi(
  li: string, teamName: string, clubIdx: string, region: string
): TeamPlayerEntry | TeamStaffEntry | null {
  // 백넘버/성명 dd (dt 쪽 <span class="name">성명</span> 라벨과 혼동 방지 —
  // 반드시 span.number 를 포함한 dd 안에서만 이름을 찾는다)
  const nameDd = (li.match(/<dd[^>]*>\s*<span class="number">[\s\S]*?<\/dd>/i) || [])[0] ?? "";
  const name =
    stripTags((nameDd.match(/<span class="name">\s*<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] ?? "") ||
    stripTags((nameDd.match(/<span class="name">([\s\S]*?)<\/span>/i) || [])[1] ?? "");
  if (!name) return null;

  const numText = stripTags((nameDd.match(/<span class="number">([\s\S]*?)<\/span>/i) || [])[1] ?? "")
    .replace(/\.$/, "");
  const number = /^\d+$/.test(numText) ? numText : "";

  const personNo = (li.match(/person_no=(\d+[A-Za-z]?\d*)/) || [])[1] ?? "";
  const gubun = (li.match(/player_view[^"']*gubun=([A-Za-z])/) || [])[1] ?? "";

  // dt 와 dd 사이에 주석(<!-- -->)이 끼는 경우가 있어 통과시킨다
  const field = (label: RegExp): string =>
    stripTags((li.match(new RegExp(`<dt[^>]*>\\s*${label.source}\\s*<\\/dt>\\s*(?:<!--[\\s\\S]*?-->\\s*)*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i")) || [])[1] ?? "");
  const position = normalizePosition(field(/선수구분/));
  const gradeRaw = field(/학년/);
  const hwRaw = field(/신장\s*\/\s*체중/);
  const throwBat = field(/투타/);

  const ddCount = (li.match(/<dd[^>]*>/gi) || []).length;
  const isStaff = gubun === "T" || (ddCount === 2 && !gradeRaw);

  if (isStaff) {
    return { type: "staff", name, role: position, person_no: personNo };
  }
  return {
    type: "player",
    number,
    name,
    position,
    grade: normalizeGrade(gradeRaw),
    height_weight: normalizeHw(hwRaw),
    throw_bat: throwBat,
    person_no: personNo,
    team: teamName,
    team_idx: clubIdx,
    region,
  };
}

// 한 팀 로스터 수집. 실패 시 예외 → 재시도 대상.
async function fetchTeamRoster(team: TeamRef, season: number): Promise<TeamRosterEntry> {
  const html = await get(
    `${BASE}/info/team/team_player?club_idx=${team.clubIdx}&season=${season}&kind_cd=${KIND.U18}`
  );
  const players: TeamPlayerEntry[] = [];
  const staff: TeamStaffEntry[] = [];
  // team_list ul 범위 내 li 만 (없으면 문서 전체 li 폴백 — roster.ts 방식)
  const ulMatch = html.match(/<ul[^>]*class="[^"]*team_list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  const scope = ulMatch ? ulMatch[1] : html;
  for (const m of scope.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const parsed = parsePlayerLi(m[1], team.name, team.clubIdx, team.region);
    if (!parsed) continue;
    if (parsed.type === "staff") staff.push(parsed);
    else players.push(parsed);
  }
  return {
    team: team.name,
    club_idx: team.clubIdx,
    region: team.region,
    manager: team.manager,
    staff,
    players,
    player_count: players.length,
  };
}

// 전 팀 병렬 수집 + 누락 재시도 (fetch_u18_rosters.py fetch_all_rosters 이식)
async function fetchAllRosters(teams: TeamRef[], season: number): Promise<TeamRosterEntry[]> {
  const byIdx = new Map<string, TeamRosterEntry>();

  const doPass = async (list: TeamRef[], workers: number) => {
    let i = 0;
    const worker = async () => {
      for (;;) {
        const t = list[i++];
        if (!t) return;
        try {
          const r = await fetchTeamRoster(t, season);
          // 완전히 비어있으면(선수0+지도자0) 일시 실패로 보고 재시도 대상
          if (r.player_count > 0 || r.staff.length > 0) {
            byIdx.set(t.clubIdx, r);
            if (byIdx.size % 20 === 0) console.log(`  …${byIdx.size}/${teams.length}팀`);
          }
        } catch (e) {
          console.warn(`    실패(재시도예정): ${t.name} - ${(e as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(workers, list.length) }, worker));
  };

  await doPass(teams, 6);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const missing = teams.filter((t) => !byIdx.has(t.clubIdx));
    if (!missing.length) break;
    console.log(`  [재시도 ${attempt}] 누락 ${missing.length}개 팀 다시 수집...`);
    await new Promise((r) => setTimeout(r, 1500));
    await doPass(missing, 3);
  }

  // 최종 누락은 빈 항목으로라도 유지(구조 보존) + 경고
  for (const t of teams) {
    if (!byIdx.has(t.clubIdx)) {
      console.warn(`  ⚠ 최종 누락: ${t.name}`);
      byIdx.set(t.clubIdx, {
        team: t.name, club_idx: t.clubIdx, region: t.region, manager: t.manager,
        staff: [], players: [], player_count: 0, error: "failed",
      });
    }
  }
  return [...byIdx.values()].sort((a, b) => a.team.localeCompare(b.team, "ko"));
}

export async function collectTeams(dataDir: string, season: number): Promise<TeamRosterEntry[]> {
  console.log("[1/2] 팀 목록 수집 중…");
  const teams = await fetchTeams(season);
  if (!teams.length) throw new Error("팀을 찾을 수 없습니다");
  console.log(`  총 ${teams.length}개 팀 발견`);

  console.log(`[2/2] ${teams.length}개 팀 로스터 수집 중…`);
  const rosters = await fetchAllRosters(teams, season);

  const fp = path.join(dataDir, String(season), "teams.json");
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(rosters));
  const totalPlayers = rosters.reduce((n, r) => n + r.player_count, 0);
  const totalStaff = rosters.reduce((n, r) => n + r.staff.length, 0);
  console.log(`✓ 팀 ${rosters.length} · 선수 ${totalPlayers} · 지도자 ${totalStaff} → data/${season}/teams.json`);
  return rosters;
}

// 직접 실행 시에만 main (collectTeams 는 다른 모듈에서 재사용 가능).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("teams.ts")) {
  const year = process.env.YEAR ? parseInt(process.env.YEAR, 10) : kstYear();
  collectTeams(DATA_DIR, year).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
