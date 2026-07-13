// 선수 프로필 수집 — /info/player/player_view?person_no=X&gubun=P
// 출신학교(초·중·고 연도별 이력)·수상내역·기본 프로필(생년월일/키·몸무게/투타)을
// data/profiles/{personNo}.json 으로 축적한다.
//
// 출신학교는 같은 연도에 학교가 2개(= 시즌 중 이적)일 수 있으며, 이 이력을
// data/roster-history.json 에도 병합해 옛 소속 박스스코어 라인의 personNo 조인
// (→ 기록 합산 병합)에 활용한다.
//
// 실행: npm run profiles           (집계된 시즌 선수 전체 재수집)
//       PROFILE_LIMIT=20 npm run profiles  (테스트용 상한)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE } from "./koreaBaseball.js";
import { readRoster, type Roster, type RosterEntry } from "./accumulate.js";
import { mergeRosterHistory } from "./roster.js";
import type { PlayerProfile, SchoolHistoryEntry, AwardEntry } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&middot;/g, "·").replace(/\s+/g, " ").trim();

async function get(url: string): Promise<string> {
  const timeout = process.env.KBSA_TIMEOUT_MS
    ? Math.max(5000, parseInt(process.env.KBSA_TIMEOUT_MS, 10))
    : 20000;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (U18 profile sync)" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

// 프로필 요약표(선수명/백넘버/생년월일/포지션/키·몸무게/투타) — th/td 쌍.
function parseSummary(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const box = (html.match(/<div class="summary_team">([\s\S]*?)<\/div>/) || [])[1] ?? "";
  for (const m of box.matchAll(/<th>\s*([\s\S]*?)\s*<\/th>\s*<td>([\s\S]*?)<\/td>/g)) {
    out.set(stripTags(m[1]), stripTags(m[2]));
  }
  return out;
}

// 출신학교 섹션: <h4>출신학교</h4> 다음 ul 의 li(타이틀 행 제외) → {지역, 소속, 연도, 포지션}
function parseSchools(html: string): SchoolHistoryEntry[] {
  const sec = (html.match(/<h4>\s*출신학교[\s\S]*?<ul>([\s\S]*?)<\/ul>/) || [])[1] ?? "";
  const out: SchoolHistoryEntry[] = [];
  for (const li of sec.matchAll(/<li(?![^>]*class="title")[^>]*>([\s\S]*?)<\/li>/g)) {
    const cells = [...li[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => stripTags(m[1]));
    if (cells.length < 3) continue;
    const [region, school, yearStr, position] = cells;
    const year = parseInt(yearStr, 10);
    if (!school || !year) continue;
    out.push({ year, region: region || undefined, school, position: position || undefined });
  }
  return out;
}

// 수상내역 섹션: {연도, 대회명, 수상명}
function parseAwards(html: string): AwardEntry[] {
  const sec = (html.match(/<h4>\s*수상내역[\s\S]*?<ul>([\s\S]*?)<\/ul>/) || [])[1] ?? "";
  const out: AwardEntry[] = [];
  for (const li of sec.matchAll(/<li(?![^>]*class="title")[^>]*>([\s\S]*?)<\/li>/g)) {
    const cells = [...li[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => stripTags(m[1]));
    if (cells.length < 3) continue;
    const [yearStr, tournament, award] = cells;
    const year = parseInt(yearStr, 10);
    if (!year || !tournament) continue;
    out.push({ year, tournament, award });
  }
  return out;
}

export async function fetchProfile(personNo: string): Promise<PlayerProfile> {
  const html = await get(`${BASE}/info/player/player_view?person_no=${personNo}&gubun=P`);
  const sum = parseSummary(html);
  const hw = sum.get("키 / 몸무게") ?? "";
  const height = (hw.match(/(\d+(?:\.\d+)?)\s*cm/) || [])[1];
  const weight = (hw.match(/(\d+(?:\.\d+)?)\s*kg/) || [])[1];
  const tb = (sum.get("투타") ?? "").match(/([좌우양])투([좌우양])타/);
  return {
    personNo,
    name: sum.get("선수명") || undefined,
    number: sum.get("백넘버") || undefined,
    birth: (sum.get("생년월일") ?? "").split("(")[0].trim() || undefined,
    height, weight,
    position: sum.get("포지션") || undefined,
    throws: tb?.[1], bats: tb?.[2],
    schools: parseSchools(html),
    awards: parseAwards(html),
    updatedAt: new Date().toISOString(),
  };
}

// 재시도+병렬 러너 (officialStats 와 동일 패턴)
async function runPool<T>(items: T[], worker: (t: T) => Promise<void>, concurrency: number) {
  let i = 0;
  const next = async (): Promise<void> => {
    const idx = i++;
    if (idx >= items.length) return;
    await worker(items[idx]);
    return next();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

// 프로필의 시즌 내 출신학교 이력 → roster-history 항목으로 변환.
// (번호 미상 `이름|` 키 — nameTeamFallback 의 (이름,팀) 유일 조인에 사용)
function historyFromProfiles(profiles: PlayerProfile[], seasons: Set<number>): Roster {
  const out: Roster = {};
  for (const p of profiles) {
    if (!p.name) continue;
    for (const s of p.schools) {
      if (!seasons.has(s.year)) continue; // 집계 대상 시즌만 (과거 초·중교 오조인 방지)
      const key = `${p.name}|`;
      const entry: RosterEntry = {
        team: s.school,
        region: s.region,
        personNo: p.personNo,
        position: s.position || p.position,
        bats: p.bats, throws: p.throws,
      };
      const arr = out[key] ?? (out[key] = []);
      if (!arr.some((e) => e.personNo === entry.personNo && e.team === entry.team)) arr.push(entry);
    }
  }
  return out;
}

// personNos 의 프로필을 수집해 data/profiles/{personNo}.json 저장 + roster-history 병합.
export async function collectProfiles(
  dataDir: string,
  personNos: string[],
  seasons: number[]
): Promise<number> {
  const dir = path.join(dataDir, "profiles");
  fs.mkdirSync(dir, { recursive: true });
  const targets = [...new Set(personNos)].filter(Boolean);
  if (targets.length === 0) return 0;
  console.log(`선수 프로필 수집 대상 ${targets.length}명…`);

  // KBSA 는 짧은 시간 다량 요청 시 스로틀링(일시 차단)하므로 완만하게 수집:
  // 동시성 3 + 요청당 지연, 실패 뭉치가 나오면 길게 쉬었다가 재시도.
  const collected: PlayerProfile[] = [];
  const failed: string[] = [];
  let doneCount = 0;
  const work = async (pn: string) => {
    try {
      const prof = await fetchProfile(pn);
      const fp = path.join(dir, `${pn}.json`);
      if (fs.existsSync(fp)) {
        const existing = JSON.parse(fs.readFileSync(fp, "utf8")) as PlayerProfile;
        if (existing.careerYears) prof.careerYears = existing.careerYears;
      }
      fs.writeFileSync(fp, JSON.stringify(prof));
      collected.push(prof);
      if (++doneCount % 200 === 0) console.log(`  …프로필 ${doneCount}/${targets.length}`);
    } catch {
      failed.push(pn);
    }
    const delay = process.env.KBSA_PROFILE_DELAY_MS
      ? Math.max(250, parseInt(process.env.KBSA_PROFILE_DELAY_MS, 10))
      : 500;
    await new Promise((r) => setTimeout(r, delay + Math.random() * 200));
  };
  const concurrency = process.env.KBSA_PROFILE_CONCURRENCY
    ? Math.max(1, parseInt(process.env.KBSA_PROFILE_CONCURRENCY, 10))
    : 2;
  await runPool(targets, work, concurrency);
  for (let attempt = 1; attempt <= 8 && failed.length; attempt++) {
    const retry = failed.splice(0);
    const wait = Math.min(15000 * 2 ** (attempt - 1), 120000);
    console.log(`  [프로필 재시도 ${attempt}] 누락 ${retry.length}명, ${wait / 1000}s 대기`);
    await new Promise((r) => setTimeout(r, wait));
    await runPool(retry, work, attempt >= 3 ? 1 : 2);
  }
  if (failed.length) console.warn(`  ⚠ 프로필 최종 누락 ${failed.length}명 (다음 실행에서 재시도됨)`);

  // 시즌 내 출신학교 이력 → roster-history 병합 (이적 선수 기록 합산의 핵심 소스).
  // 이번에 수집한 것만이 아니라 디스크의 프로필 전체를 반영(이어받기/과거 수집분 포함).
  const all: PlayerProfile[] = fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as PlayerProfile);
  let added = 0;
  for (const season of seasons) {
    const hist = historyFromProfiles(all, new Set([season]));
    added += mergeRosterHistory(dataDir, hist, season);
  }
  console.log(`✓ 프로필 ${collected.length}명 수집 (보유 ${all.length}) · 이력 신규 ${added}건 병합`);
  return collected.length;
}

// 이미 프로필 파일이 있는 personNo 집합 (증분 스킵 판단용).
export function existingProfileIds(dataDir: string): Set<string> {
  const dir = path.join(dataDir, "profiles");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  );
}

// 전체 수집 모드: 로스터의 모든 personNo (시즌 등록 선수 전체) 대상.
// SKIP_EXISTING=1 이면 이미 수집된 프로필은 건너뜀(중단 후 이어받기).
async function main() {
  const roster = readRoster(DATA_DIR);
  const personNos = new Set<string>();
  for (const arr of Object.values(roster)) for (const e of arr) if (e.personNo) personNos.add(e.personNo);
  let list = [...personNos];
  if (process.env.SKIP_EXISTING) {
    const have = existingProfileIds(DATA_DIR);
    list = list.filter((pn) => !have.has(pn));
    console.log(`이어받기: 기존 ${have.size}명 스킵, 남은 ${list.length}명`);
  }
  if (process.env.PROFILE_LIMIT) list = list.slice(0, parseInt(process.env.PROFILE_LIMIT, 10));
  const yearsFp = path.join(DATA_DIR, "years.json");
  const seasons: number[] = fs.existsSync(yearsFp)
    ? (JSON.parse(fs.readFileSync(yearsFp, "utf8")) as number[])
    : [new Date().getFullYear()];
  await collectProfiles(DATA_DIR, list, seasons);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("playerProfiles.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
