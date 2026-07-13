// KBSA U18 시즌 경기 일정/결과 수집기 — 경기일정 페이지용 data/{year}/schedule.json 생성.
// 이식 원본: u81-baseball/fetch_u18_schedule.py.
//
// calendar 페이지에서 월별 game_idx 를 모은 뒤, box_score 페이지에서
// 대회명·날짜·시간·구장·라운드·양팀·점수·승패·취소여부를 가져온다.
// 주말리그 공식 순위(전적표 match_table)도 함께 수집(순위표 표시용).
//
// 실행: npm run schedule           → 증분 (완료/취소 보존, 예정+신규+최근3일 재수집)
//       SCHEDULE_FULL=1 npm run schedule → 전체 재수집
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, KIND } from "./koreaBaseball.js";
import { kstYear } from "./teams.js";
import type { ScheduleData, ScheduleGame, ScheduleSide, TeamRosterEntry } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

// 주석 제거: 정규식 캡처 구간이 주석 중간에서 잘리면 "-->"/"<!--" 파편이 남으므로 함께 제거.
const stripComments = (s: string) =>
  s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<!--|-->/g, " ");
const stripTags = (s: string) =>
  stripComments(s).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// 일시 오류 재시도 — 지수 백오프 5회 (5,10,20,40,40초; 원본 파이썬과 동일 리듬)
async function get(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(5000 * 2 ** (attempt - 1), 40000)));
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (U18 schedule sync)" } });
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

const nowKst = () => new Date(Date.now() + 9 * 3600 * 1000);
const kstStamp = () => {
  const d = nowKst();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

// 월별 calendar 에서 모든 game_idx 수집 (중복 제거)
async function collectGameIdxs(year: number, months: number[]): Promise<string[]> {
  const idxs = new Set<string>();
  for (const m of months) {
    try {
      const html = await get(`${BASE}/game/calendar?month=${m}&year=${year}&kind_cd=${KIND.U18}`);
      let found = 0;
      for (const a of html.matchAll(/box_score[^"']*game_idx=(\d+)/g)) {
        idxs.add(a[1]);
        found++;
      }
      console.log(`  ${year}.${String(m).padStart(2, "0")}월: game_idx ${found}개`);
    } catch (e) {
      console.warn(`  ⚠ ${year}.${String(m).padStart(2, "0")}월 calendar 최종 실패: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return [...idxs].sort((a, b) => Number(a) - Number(b));
}

// box_score 한 경기 파싱 (fetch_u18_schedule.py parse_box_score 이식)
async function parseBoxScore(gameIdx: string): Promise<ScheduleGame | null> {
  const html = await get(`${BASE}/game/box_score?game_idx=${gameIdx}`);

  // 대회명 + 날짜/시간/구장/라운드: <dl class="game_name"><dt>대회명</dt><dd>2026.05.02 09:30 / 목동야구장 / 예선전</dd>
  let title = "";
  let date = "", time = "", venue = "", rnd = "";
  const gname = html.match(/<dl[^>]*class="game_name"[^>]*>([\s\S]*?)<\/dl>/i);
  if (gname) {
    title = stripTags((gname[1].match(/<dt[^>]*>([\s\S]*?)<\/dt>/i) || [])[1] ?? "");
  }
  // 날짜가 들어있는 첫 dd 에서 날짜/시간/구장/라운드 추출 (원본과 동일: 문서 전체 dd 순회)
  for (const dd of html.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const t = stripTags(dd[1]);
    const mdate = t.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (!mdate) continue;
    date = `${mdate[1]}-${mdate[2].padStart(2, "0")}-${mdate[3].padStart(2, "0")}`;
    time = (t.match(/(\d{1,2}:\d{2})/) || [])[1] ?? "";
    const parts = t.split("/").map((p) => p.trim());
    if (parts.length >= 2) venue = parts[1];
    if (parts.length >= 3) rnd = parts[2];
    break;
  }

  // 양팀: dl.team 첫 2개가 "팀명 승/패 점수" (예정이면 점수 없음)
  const parsed: ScheduleSide[] = [];
  for (const tm of html.matchAll(/<dl[^>]*class="[^"]*\bteam\b[^"]*"[^>]*>([\s\S]*?)<\/dl>/gi)) {
    if (parsed.length >= 2) break;
    const txt = stripTags(tm[1]);
    const m = txt.match(/^(.*?)\s*(승|패|무)?\s*(\d+)?$/);
    if (m) {
      parsed.push({
        name: (m[1] ?? "").trim(),
        result: m[2] ?? "",
        score: m[3] != null ? parseInt(m[3], 10) : null,
      });
    }
  }
  if (parsed.length < 2) return null;

  // 취소 여부: [경기취소] 등 빨간 라벨
  let cancelled = false;
  for (const dt of html.matchAll(/<dt[^>]*class="[^"]*font_red[^"]*"[^>]*>([\s\S]*?)<\/dt>/gi)) {
    if (stripTags(dt[1]).includes("취소")) { cancelled = true; break; }
  }

  const status = cancelled
    ? "취소"
    : parsed[0].score != null && parsed[1].score != null
      ? "완료"
      : "예정";

  return {
    game_idx: gameIdx,
    title,
    date,
    time,
    venue,
    round: rnd,
    status,
    away: parsed[0], // calendar 표기 첫 팀
    home: parsed[1], // 두 번째 팀
  };
}

// 전적표(match_table)에서 주말리그 권역별 협회 공식 순위(팀명 순서) 수집.
// 동률 처리(승자승·실점률 등)는 협회 기준이 복잡해 자체 계산과 어긋날 수 있으므로
// 전적표에 표시되는 공식 순서를 그대로 가져와 순위표에 사용한다. 실패한 권역은 건너뛴다.
async function fetchOfficialRanks(year: number): Promise<Record<string, string[]>> {
  const ranks: Record<string, string[]> = {};
  let ligs: [string, string][];
  try {
    const html = await get(`${BASE}/game/match_table?kind_cd=${KIND.U18}&season=${year}`);
    ligs = [...html.matchAll(/<option lig_idx="(\d+)"[^>]*>\s*([^<]*주말리그[^<]*?)\s*<\/option>/g)]
      .map((m) => [m[1], m[2].replace(/\s+/g, " ").trim()]);
  } catch (e) {
    console.warn(`  ⚠ 전적표 목록 조회 실패: ${(e as Error).message}`);
    return ranks;
  }
  for (const [ligIdx, name] of ligs) {
    try {
      const html = await get(`${BASE}/game/match_table?kind_cd=${KIND.U18}&season=${year}&lig_idx=${ligIdx}`);
      const teams: string[] = [];
      // 행 순서 = 공식 순위(order_number)
      for (const club of html.matchAll(/<div[^>]*class="[^"]*match-club[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*match-club|$)/gi)) {
        const t = stripTags((club[1].match(/<span[^>]*class="[^"]*\bteam\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i) || [])[1] ?? "");
        if (t) teams.push(t);
      }
      if (teams.length) ranks[name] = teams;
    } catch (e) {
      console.warn(`  ⚠ 전적표 조회 실패(${name}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`  공식 순위 수집: ${Object.keys(ranks).length}개 권역`);
  return ranks;
}

// game_idx 목록을 병렬+재시도로 파싱 (fetch_u18_schedule.py collect_games 이식)
async function collectGames(idxs: string[]): Promise<Map<string, ScheduleGame>> {
  const byIdx = new Map<string, ScheduleGame>();

  const doPass = async (list: string[], workers: number) => {
    let i = 0;
    const worker = async () => {
      for (;;) {
        const gid = list[i++];
        if (!gid) return;
        try {
          const g = await parseBoxScore(gid);
          if (g) byIdx.set(gid, g);
        } catch (e) {
          console.warn(`    box_score ${gid} 실패: ${(e as Error).message}`);
        }
        if (byIdx.size % 50 === 0 && byIdx.size > 0) console.log(`  ${byIdx.size}/${idxs.length} …`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(workers, list.length) }, worker));
  };

  await doPass(idxs, 5); // 동시성 과다 요청은 차단 유발 → 소수 워커

  // 누락분 재시도: 지수 백오프 + 후반 순차
  for (let attempt = 1; attempt <= 10; attempt++) {
    const missing = idxs.filter((g) => !byIdx.has(g));
    if (!missing.length) break;
    const wait = Math.min(5000 * 2 ** (attempt - 1), 40000);
    const workers = attempt >= 5 ? 1 : 3;
    console.log(`  [재시도 ${attempt}] 누락 ${missing.length}건, ${wait / 1000}초 대기 (worker=${workers})…`);
    await new Promise((r) => setTimeout(r, wait));
    await doPass(missing, workers);
  }
  const missing = idxs.filter((g) => !byIdx.has(g));
  if (missing.length) console.warn(`  ⚠ 최종 누락 ${missing.length}건: ${missing.slice(0, 20).join(",")}`);
  return byIdx;
}

// ── 팀명 표기 정규화: 일정(box_score) 표기를 선수현황(teams.json) 정식명으로 통일 ──
// (generate_schedule.py 의 ALIAS_EXPLICIT + _core 접미사 제거 로직 이식)
const ALIAS_EXPLICIT: Record<string, string> = {
  상우고: "상우고야구단",
};
const coreName = (s: string): string => {
  let t = s;
  for (const suf of ["(U-18)", "야구단", "BC", "고등학교"]) t = t.split(suf).join("");
  return t.trim();
};

function readTeamNames(dataDir: string, year: number): Set<string> {
  const fp = path.join(dataDir, String(year), "teams.json");
  if (!fs.existsSync(fp)) return new Set();
  try {
    const rows = JSON.parse(fs.readFileSync(fp, "utf8")) as TeamRosterEntry[];
    return new Set(rows.map((t) => t.team).filter(Boolean));
  } catch {
    return new Set();
  }
}

function normalizeTeamNames(data: ScheduleData, rosterNames: Set<string>): void {
  if (!rosterNames.size) return;
  // roster 핵심이름 → 정식이름 (충돌 시 자동매칭 제외)
  const coreToRoster = new Map<string, string>();
  const collisions = new Set<string>();
  for (const rn of rosterNames) {
    const c = coreName(rn);
    if (!c) continue;
    if (coreToRoster.has(c) && coreToRoster.get(c) !== rn) collisions.add(c);
    coreToRoster.set(c, rn);
  }
  const alias = new Map<string, string>();
  const resolve = (sn: string): string | undefined => {
    if (ALIAS_EXPLICIT[sn]) return ALIAS_EXPLICIT[sn];
    if (rosterNames.has(sn)) return undefined;
    const c = coreName(sn);
    if (coreToRoster.has(c) && !collisions.has(c)) return coreToRoster.get(c);
    return undefined;
  };
  let applied = 0;
  for (const g of data.games) {
    for (const side of [g.away, g.home]) {
      const to = alias.get(side.name) ?? resolve(side.name);
      if (to) {
        alias.set(side.name, to);
        side.name = to;
        applied++;
      }
    }
  }
  if (data.official_ranks) {
    for (const key of Object.keys(data.official_ranks)) {
      data.official_ranks[key] = data.official_ranks[key].map(
        (n) => alias.get(n) ?? resolve(n) ?? n
      );
    }
  }
  if (applied) console.log(`  팀명 정규화 ${alias.size}건 (적용 ${applied}회)`);
}

const scheduleFile = (dataDir: string, year: number) =>
  path.join(dataDir, String(year), "schedule.json");

function saveSchedule(
  dataDir: string, year: number, games: ScheduleGame[], officialRanks: Record<string, string[]>
): ScheduleGame[] {
  const sorted = [...games].sort(
    (a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "").localeCompare(b.time || "")
  );
  const out: ScheduleData = { year, updated: kstStamp(), games: sorted };
  if (Object.keys(officialRanks).length) out.official_ranks = officialRanks;
  normalizeTeamNames(out, readTeamNames(dataDir, year));
  const fp = scheduleFile(dataDir, year);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(out));
  return out.games;
}

// 전체 수집
async function mainFull(dataDir: string, year: number): Promise<void> {
  console.log(`=== U-18 ${year}시즌 일정/결과 전체 수집 ===`);
  console.log(`[1/3] 월별 game_idx 수집…`);
  const idxs = await collectGameIdxs(year, Array.from({ length: 12 }, (_, i) => i + 1));
  console.log(`  총 ${idxs.length}경기 발견`);
  console.log(`[2/3] 경기 상세 수집… (구장/시간 포함)`);
  const byIdx = await collectGames(idxs);
  console.log(`[3/3] 주말리그 공식 순위(전적표) 수집…`);
  const ranks = await fetchOfficialRanks(year);
  const games = saveSchedule(dataDir, year, [...byIdx.values()], ranks);
  const done = games.filter((g) => g.status === "완료").length;
  console.log(`✓ 총 ${games.length}경기 (완료 ${done} / 그 외 ${games.length - done}) → data/${year}/schedule.json`);
}

// 증분 수집: 완료/취소 경기는 보존, 예정 + 신규(누락) + 최근 3일치만 재수집해 병합.
// (fetch_u18_schedule.py main_incremental 이식)
async function mainIncremental(dataDir: string, year: number): Promise<void> {
  const fp = scheduleFile(dataDir, year);
  if (!fs.existsSync(fp)) {
    console.log("기존 schedule.json 없음 → 전체 수집으로 대체합니다.");
    return mainFull(dataDir, year);
  }
  const existing = JSON.parse(fs.readFileSync(fp, "utf8")) as ScheduleData;
  const existingGames = existing.games ?? [];
  const existingIdx = new Set(existingGames.map((g) => g.game_idx));
  const baseYear = existing.year ?? year;
  console.log(`=== U-18 ${baseYear}시즌 일정 증분 수집 (예정 + 신규/누락 + 최근 3일) ===`);

  const pendingIdx = new Set(existingGames.filter((g) => g.status === "예정").map((g) => g.game_idx));
  const recentDays = new Set<string>();
  for (let k = 0; k < 3; k++) {
    const d = nowKst();
    d.setUTCDate(d.getUTCDate() - k);
    recentDays.add(d.toISOString().slice(0, 10));
  }
  const recentIdx = new Set(existingGames.filter((g) => recentDays.has(g.date)).map((g) => g.game_idx));

  console.log(`[1/3] ${year}년 전체 calendar 스캔 (신규/누락 game_idx 탐지)…`);
  const allIdx = new Set(await collectGameIdxs(year, Array.from({ length: 12 }, (_, i) => i + 1)));
  const newIdx = [...allIdx].filter((g) => !existingIdx.has(g));
  const candidates = [...new Set([...pendingIdx, ...newIdx, ...recentIdx])].sort((a, b) => Number(a) - Number(b));
  console.log(`  대상 ${candidates.length}건 (예정 ${pendingIdx.size} + 신규/누락 ${newIdx.length} + 최근3일 ${recentIdx.size})`);

  console.log(`[2/3] 대상 경기 상세 수집…`);
  const fetched = candidates.length ? await collectGames(candidates) : new Map<string, ScheduleGame>();
  console.log(`  ${fetched.size}건 수집 완료`);

  // 공식 순위는 경기 변경과 무관하게 매번 갱신 (실패 시 기존 값 유지)
  console.log(`[3/3] 주말리그 공식 순위(전적표) 수집…`);
  const ranks = await fetchOfficialRanks(baseYear);
  const finalRanks = Object.keys(ranks).length ? ranks : existing.official_ranks ?? {};

  if (!fetched.size && JSON.stringify(finalRanks) === JSON.stringify(existing.official_ranks ?? {})) {
    console.log("갱신할 데이터가 없습니다. (변경 없음)");
    return;
  }
  // 병합: game_idx 기준 덮어쓰기/추가, 완료/취소 등 나머지는 그대로 유지
  const merged = new Map(existingGames.map((g) => [g.game_idx, g]));
  for (const [k, v] of fetched) merged.set(k, v);
  const games = saveSchedule(dataDir, baseYear, [...merged.values()], finalRanks);
  const done = games.filter((g) => g.status === "완료").length;
  console.log(`✓ 재수집 ${fetched.size}건 · 전체 ${games.length}경기 (완료 ${done}) → data/${baseYear}/schedule.json`);
}

export async function collectSchedule(dataDir: string, year: number, full: boolean): Promise<void> {
  if (full) await mainFull(dataDir, year);
  else await mainIncremental(dataDir, year);
}

// 직접 실행 시에만 main.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("schedule.ts")) {
  const year = process.env.YEAR ? parseInt(process.env.YEAR, 10) : kstYear();
  collectSchedule(DATA_DIR, year, process.env.SCHEDULE_FULL === "1").catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
