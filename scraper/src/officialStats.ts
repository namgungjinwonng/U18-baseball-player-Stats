// 공식 선수 시즌기록 수집 — /record/record/player_record (선수별, dt/dd 구조).
// 박스스코어 파생 대신 공식 수치를 권위 소스로 사용(타격/투구). 매치업은 박스스코어 유지.
//
// 실행: npm run official   (data/{year}/official.json 생성: personNo → {batting, pitching})
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, KIND } from "./koreaBaseball.js";
import { lookupRoster, readRoster } from "./accumulate.js";
import { collectionYear } from "./collectionYear.js";
import type { BattingStats, GameBoxScore, PitchingStats } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

const r3 = (n: number) => Number(n.toFixed(3));
const r2 = (n: number) => Number(n.toFixed(2));
const outsToIp = (outs: number) => Number((Math.floor(outs / 3) + (outs % 3) / 10).toFixed(1));
const ipToOuts = (ip: number) => {
  const w = Math.floor(ip);
  return w * 3 + Math.round((ip - w) * 10);
};

async function get(url: string): Promise<string> {
  const timeout = process.env.KBSA_TIMEOUT_MS
    ? Math.max(5000, parseInt(process.env.KBSA_TIMEOUT_MS, 10))
    : 20000;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (U18 official sync)" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

// player_record 각 경기 행을 dt/dd 맵으로 파싱
function parseRows(html: string): Map<string, string>[] {
  const list = (html.match(/<ul class="record_list"[^>]*>([\s\S]*?)<\/ul>/i) || [])[1] || "";
  const rows = [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1]);
  return rows.map((row) => {
    const map = new Map<string, string>();
    for (const m of row.matchAll(/<dt>\s*([^<]+?)\s*<\/dt>\s*<dd>\s*([^<]*?)\s*<\/dd>/gi)) {
      map.set(m[1].trim(), m[2].trim());
    }
    return map;
  });
}
const num = (m: Map<string, string>, k: string) => parseInt((m.get(k) ?? "").replace(/[^\d-]/g, ""), 10) || 0;
const flt = (m: Map<string, string>, k: string) => parseFloat((m.get(k) ?? "").replace(/[^\d.]/g, "")) || 0;

export function sumBatting(rows: Map<string, string>[]): BattingStats {
  let g = 0, pa = 0, ab = 0, r = 0, h = 0, b2 = 0, b3 = 0, hr = 0, rbi = 0, bb = 0, hbp = 0, so = 0, sb = 0;
  let sh = 0, sf = 0, ibb = 0, e = 0;
  for (const m of rows) {
    if (!m.has("타수")) continue;
    g++; pa += num(m, "타석"); ab += num(m, "타수"); r += num(m, "득점"); h += num(m, "총안타");
    b2 += num(m, "2루타"); b3 += num(m, "3루타"); hr += num(m, "홈런"); rbi += num(m, "타점");
    bb += num(m, "볼넷"); hbp += num(m, "사구"); so += num(m, "삼진"); sb += num(m, "도루");
    sh += num(m, "희타"); sf += num(m, "희비"); ibb += num(m, "고의4구"); e += num(m, "실책");
  }
  const singles = h - b2 - b3 - hr;
  const tb = singles + 2 * b2 + 3 * b3 + 4 * hr;
  const obDen = ab + bb + hbp;
  return {
    g, pa: pa || ab + bb + hbp, ab, r, h, b2, b3, hr, rbi, bb, hbp, so, sb, sh, sf, ibb, e,
    avg: ab ? r3(h / ab) : 0,
    obp: obDen ? r3((h + bb + hbp) / obDen) : 0,
    slg: ab ? r3(tb / ab) : 0,
  };
}

export function sumPitching(rows: Map<string, string>[]): PitchingStats {
  let g = 0, w = 0, l = 0, outs = 0, h = 0, hr = 0, r = 0, er = 0, bb = 0, so = 0, bf = 0, np = 0;
  for (const m of rows) {
    if (!m.has("이닝")) continue;
    g++; outs += ipToOuts(flt(m, "이닝"));
    h += num(m, "피안타"); hr += num(m, "피홈런"); r += num(m, "실점"); er += num(m, "자책점") + num(m, "자책");
    bb += num(m, "볼넷") + num(m, "사구"); so += num(m, "탈삼진"); // 라벨은 '탈삼진'
    bf += num(m, "타자"); np += num(m, "투구수");
    w += num(m, "승"); l += num(m, "패");
  }
  return {
    g, w, l, sv: 0, ip: outsToIp(outs), h, hr, r, er, bb, so, bf, np,
    era: outs ? r2((er * 27) / outs) : 0,
    whip: outs ? r2(((h + bb) * 3) / outs) : 0,
  };
}

async function fetchOfficial(clubIdx: string, personNo: string, recordType: 1 | 2, year: number) {
  const u = `${BASE}/record/record/player_record?kind_cd=${KIND.U18}&club_idx=${clubIdx}&person_no=${personNo}&record_type=${recordType}&begin_year=${year}&end_year=${year}`;
  const rows = parseRows(await get(u));
  return recordType === 1 ? sumBatting(rows) : sumPitching(rows);
}

// --- 재시도+병렬 러너 (u81 방식: 누락분 지수 백오프, 후반 동시성↓) ---
export interface OfficialRecord {
  batting?: BattingStats;
  pitching?: PitchingStats;
}
interface Job {
  personNo: string; clubIdx: string; bat: boolean; pit: boolean;
}

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

export async function collectOfficial(
  dataDir: string,
  year: number,
  // 특정 경기 파일만 대상으로 제한(증분). 미지정 시 전체 게임.
  onlyGameFiles?: string[]
): Promise<Record<string, OfficialRecord>> {
  const roster = readRoster(dataDir, year);
  // 게임에 등장한 (이름,등번호) → 타격/투구 여부
  const gamesDir = path.join(dataDir, "games");
  const need = new Map<string, Job>(); // personNo → job
  if (fs.existsSync(gamesDir)) {
    const files = onlyGameFiles ?? fs.readdirSync(gamesDir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const g = JSON.parse(fs.readFileSync(path.join(gamesDir, f), "utf8")) as GameBoxScore;
      const mark = (name: string, id: string, kind: "bat" | "pit", team: string) => {
        const number = id.split("_").pop() ?? "";
        const ros = lookupRoster(roster, name, number, team);
        if (!ros?.personNo || !ros.clubIdx) return;
        const job = need.get(ros.personNo) ?? { personNo: ros.personNo, clubIdx: ros.clubIdx, bat: false, pit: false };
        job[kind] = true;
        need.set(ros.personNo, job);
      };
      for (const b of g.batters) mark(b.name, b.playerId, "bat", b.team);
      for (const p of g.pitchers) mark(p.name, p.playerId, "pit", p.team);
    }
  }
  const partialFp = path.join(dataDir, String(year), "official.partial.json");
  fs.mkdirSync(path.dirname(partialFp), { recursive: true });
  const out: Record<string, OfficialRecord> = fs.existsSync(partialFp)
    ? (JSON.parse(fs.readFileSync(partialFp, "utf8")) as Record<string, OfficialRecord>)
    : {};
  const jobs = [...need.values()].filter((job) => !out[job.personNo]);
  console.log(`공식기록 수집 대상 ${jobs.length}명 (체크포인트 ${Object.keys(out).length}명)…`);

  let savedSinceCheckpoint = 0;
  const failed: Job[] = [];
  const work = async (job: Job) => {
    try {
      const rec: OfficialRecord = {};
      if (job.bat) rec.batting = (await fetchOfficial(job.clubIdx, job.personNo, 1, year)) as BattingStats;
      if (job.pit) rec.pitching = (await fetchOfficial(job.clubIdx, job.personNo, 2, year)) as PitchingStats;
      out[job.personNo] = rec;
      savedSinceCheckpoint++;
      if (savedSinceCheckpoint >= 50) {
        fs.writeFileSync(partialFp, JSON.stringify(out));
        savedSinceCheckpoint = 0;
      }
    } catch {
      failed.push(job);
    }
  };
  const concurrency = process.env.KBSA_OFFICIAL_CONCURRENCY
    ? Math.max(1, parseInt(process.env.KBSA_OFFICIAL_CONCURRENCY, 10))
    : 2;
  await runPool(jobs, work, concurrency);

  // 누락 재시도 (지수 백오프, 후반 동시성↓)
  for (let attempt = 1; attempt <= 8 && failed.length; attempt++) {
    const retry = failed.splice(0);
    const wait = Math.min(5000 * 2 ** (attempt - 1), 40000);
    const workers = attempt >= 3 ? 1 : Math.min(2, concurrency);
    console.log(`  [재시도 ${attempt}] 누락 ${retry.length}명, ${wait / 1000}s 대기 (worker=${workers})`);
    await new Promise((r) => setTimeout(r, wait));
    await runPool(retry, work, workers);
  }
  if (failed.length) {
    fs.writeFileSync(partialFp, JSON.stringify(out));
    console.warn(`  ⚠ 최종 누락 ${failed.length}명 (다음 실행에서 체크포인트 재개)`);
  } else if (fs.existsSync(partialFp)) {
    fs.rmSync(partialFp);
  }
  console.log(`✓ 공식기록 ${Object.keys(out).length}명 수집`);
  return out;
}

async function main() {
  const year = collectionYear();
  const official = await collectOfficial(DATA_DIR, year);
  const fp = path.join(DATA_DIR, String(year), "official.json");
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(official) + "\n");
  console.log(`→ ${fp}`);
}

// 직접 실행 시에만 main (collectOfficial 은 다른 모듈에서 재사용 가능)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("officialStats.ts")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
