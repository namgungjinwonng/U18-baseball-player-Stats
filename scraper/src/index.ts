// 스크레이프 진입점 (GitHub Actions / 로컬 수동 실행).
//
// 1) 신규 경기를 수집해 data/games/{id}.json 으로 저장(멱등: 신규만).
// 2) data/games/*.json 전체에서 선수 집계/상대전적/색인/메타를 파생.
//
// 수집(1)은 내부 API 확정 전까지 미구현일 수 있으나, 파생(2)은 항상 수행되어
// 기존 경기로부터 결정적으로 데이터를 재생성한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregate, groupBySeason, lookupRoster, readGames, readRoster, readRosterHistory,
  writeYear, writeYearsIndex,
} from "./accumulate.js";
import {
  emptyGameIds, emptyGameMonths, existingGameIds, incrementalMonths, isAfterSeasonStart, listGameRefs,
} from "./fetchGames.js";
import { parseRecordDetail } from "./parseRecord.js";
import { collectOfficial } from "./officialStats.js";
import { collectProfiles, existingProfileIds } from "./playerProfiles.js";
import { computeLeagueRates } from "./leagueAverages.js";
import { buildStrength } from "./strength.js";
import type { GameBoxScore, LeagueAverages, Meta } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const SOURCE = "korea-baseball.com (KBSA)";

// 시합/대회명 → 파일시스템/URL 호환 슬러그(한글 유지).
function tournamentSlug(title: string): string {
  let s = title.trim().replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "-");
  if (s.length > 80) s = s.slice(0, 80);
  return s || "untitled";
}

// 한 번에 수집할 신규 경기 상한(미설정 시 무제한). 초기 적재/테스트용.
const GAME_LIMIT = process.env.GAME_LIMIT ? parseInt(process.env.GAME_LIMIT, 10) : Infinity;
// 수집 대상 월(쉼표구분, 예: "6" 또는 "5,6"). 미설정 시 fetchGames 기본(3~12월).
const MONTHS = process.env.MONTHS
  ? process.env.MONTHS.split(",").map((s) => parseInt(s, 10))
  : undefined;

// record_detail 연속 요청 간 지연 — KBSA 는 대량 요청 시 스로틀링하므로 예방적 간격.
const FETCH_DELAY_MS = 250;
const politeDelay = () => new Promise((r) => setTimeout(r, FETCH_DELAY_MS));

async function collectNewGames(): Promise<string[]> {
  const newFiles: string[] = [];
  const fetchOne = async (ref: { id: string; date: string }): Promise<"ok" | "gone" | "fail"> => {
    try {
      const box = await parseRecordDetail(ref as never);
      const fp = path.join(DATA_DIR, "games", `${box.id}.json`);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(box, null, 2) + "\n");
      newFiles.push(`${box.id}.json`);
      console.log(`+ 경기 추가: ${box.id} (${box.date})`);
      return "ok";
    } catch (e) {
      // 410 Gone = 영구 실패(재시도 제외). 그 외는 일시 실패로 재시도 대상.
      return /410/.test((e as Error).message) ? "gone" : "fail";
    }
  };
  // 취소 경기(캘린더 <strike>·"(취소)") — record_detail 이 빈 껍데기이므로 fetch 대신
  // 취소 마커 파일을 저장해 재수집 루프를 끊는다. 이미 마커가 있으면 no-op.
  const writeCanceled = (ref: { id: string; date: string; home: string; away: string }): boolean => {
    const fp = path.join(DATA_DIR, "games", `${ref.id}.json`);
    let prevTitle: string | undefined;
    if (fs.existsSync(fp)) {
      try {
        const prev = JSON.parse(fs.readFileSync(fp, "utf8")) as GameBoxScore;
        if (prev.canceled) return false;
        prevTitle = prev.title;
      } catch { /* 손상 파일 → 새로 씀 */ }
    }
    const box: GameBoxScore = {
      id: ref.id,
      date: ref.date,
      season: parseInt(ref.date.slice(0, 4), 10),
      home: ref.home,
      away: ref.away,
      score: { home: 0, away: 0 },
      ...(prevTitle ? { title: prevTitle } : {}),
      canceled: true,
      batters: [],
      pitchers: [],
      matchups: [],
    };
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(box, null, 2) + "\n");
    console.log(`× 취소 경기 마킹: ${ref.id} (${ref.date} ${ref.away} vs ${ref.home})`);
    return true;
  };
  try {
    // 증분: env 미지정 시 마지막 수집 경기의 월부터만 스캔(시간 절약).
    // 단, 최근 3일치(오늘·어제·그제) 캘린더 월은 항상 포함해 진행 중 경기를 따라잡는다.
    // (참고: U-18 Baseball/fetch_u18_schedule.py main_incremental — 최근 N일 무조건 재수집)
    const baseMonths = MONTHS ?? incrementalMonths(DATA_DIR);
    // MONTHS=0 = 재집계 전용(캘린더/박스 호출 스킵).
    if (MONTHS && MONTHS.length === 1 && MONTHS[0] === 0) {
      console.log("MONTHS=0 → 캘린더 스캔 스킵 (재집계 전용 모드)");
      return [];
    }
    const todayISO = new Date().toISOString().slice(0, 10);
    const recentMonth = parseInt(todayISO.slice(5, 7), 10);
    // 증분 스캔 월 = base + 오늘 월 + 빈 경기가 있는 월(이전 달의 미수집 보강).
    const months = [...new Set([...baseMonths, recentMonth, ...emptyGameMonths(DATA_DIR)])]
      .sort((a, b) => a - b);
    const refs = await listGameRefs(2026, months);
    const have = existingGameIds(DATA_DIR);
    // 최근 3일치 game_idx 는 이미 수집되어 있어도 강제 재수집(점수 0-0 오인·실시간 업데이트 교정).
    const recentDays = new Set<string>();
    for (let k = 0; k < 3; k++) {
      const d = new Date();
      d.setDate(d.getDate() - k);
      recentDays.add(d.toISOString().slice(0, 10));
    }
    // 이미 수집됐지만 박스스코어가 비어있는(타자 0명) 경기 = 수집 당시 record_detail 이
    // 일시적으로 비어있던 케이스. game_idx 가 있어 증분이 건너뛰므로 별도로 재수집한다.
    const emptyIds = emptyGameIds(DATA_DIR);
    const recentRefs = refs.filter((r) => recentDays.has(r.date) && have.has(r.id));
    const emptyRefs = refs.filter((r) => emptyIds.has(r.id));
    const eligible = refs.filter(
      (r) =>
        (!have.has(r.id) || recentDays.has(r.date) || emptyIds.has(r.id)) &&
        isAfterSeasonStart(r.date) &&
        // 미래 경기(캘린더 선등록)는 기록이 없으므로 스킵 — 경기일이 지나면 자동 수집.
        r.date <= todayISO
    );
    if (recentRefs.length) console.log(`  ↻ 최근 3일치 ${recentRefs.length}경기 재수집 대상`);
    if (emptyRefs.length) console.log(`  ↻ 빈 박스스코어 ${emptyRefs.length}경기 재수집 대상`);
    const todo = GAME_LIMIT === Infinity ? eligible : eligible.slice(0, GAME_LIMIT);
    let failed: typeof todo = [];
    for (const ref of todo) {
      if (ref.canceled) { writeCanceled(ref); continue; } // fetch 없이 마커만
      if ((await fetchOne(ref)) === "fail") failed.push(ref);
      await politeDelay();
    }
    // 누락(일시 실패) 재시도: 지수 백오프 최대 5회
    for (let attempt = 1; attempt <= 5 && failed.length; attempt++) {
      const retry = failed;
      failed = [];
      const wait = Math.min(5000 * 2 ** (attempt - 1), 40000);
      console.log(`  [경기 재시도 ${attempt}] 누락 ${retry.length}건, ${wait / 1000}s 대기`);
      await new Promise((r) => setTimeout(r, wait));
      for (const ref of retry) {
        if ((await fetchOne(ref)) === "fail") failed.push(ref);
        await politeDelay();
      }
    }
    if (failed.length) console.warn(`  ⚠ 최종 누락 ${failed.length}경기(일시실패)`);
  } catch (e) {
    console.warn(`⚠ 경기 목록 수집 실패: ${(e as Error).message}`);
  }
  return newFiles;
}

// 신규 경기에 등장한 선수만 공식기록 증분 수집 → 기존 official.json 에 병합.
async function updateOfficialFor(year: number, newGameFiles: string[]) {
  if (newGameFiles.length === 0) return;
  const offFp = path.join(DATA_DIR, String(year), "official.json");
  const existing = fs.existsSync(offFp) ? JSON.parse(fs.readFileSync(offFp, "utf8")) : {};
  const fresh = await collectOfficial(DATA_DIR, year, newGameFiles);
  const merged = { ...existing, ...fresh };
  fs.mkdirSync(path.dirname(offFp), { recursive: true });
  fs.writeFileSync(offFp, JSON.stringify(merged));
  console.log(`✓ 공식기록 병합: 신규 ${Object.keys(fresh).length}명 (총 ${Object.keys(merged).length})`);
}

// 프로필 증분 수집 — "변동사항이 있는 선수만" 수집해 실행 시간을 최소화한다.
// 수집 대상: ① 프로필 파일이 없는 선수 ② 현행 로스터 소속 ≠ 프로필의 당해연도 학교(=이적 신호).
// 20시간 이내 수집분은 무조건 스킵(재수집 루프 방지). 수상내역 같은 저빈도 변동은
// 전체 수집 워크플로(scrape-full 의 npm run profiles)가 주기적으로 갱신한다.
async function updateProfilesFor(
  games: GameBoxScore[], _newGameFiles: string[], years: number[]
) {
  const roster = readRoster(DATA_DIR);
  const have = existingProfileIds(DATA_DIR);
  const season = Math.max(...years);
  const FRESH_MS = 20 * 60 * 60 * 1000;

  const needsUpdate = (pn: string, rosterTeam?: string): boolean => {
    if (!have.has(pn)) return true; // 프로필 미보유 → 수집
    try {
      const prof = JSON.parse(
        fs.readFileSync(path.join(DATA_DIR, "profiles", `${pn}.json`), "utf8")
      ) as { updatedAt?: string; schools?: { year: number; school: string }[] };
      // 방금 수집한 프로필은 스킵 (팀명 표기차로 인한 매일 재수집 루프 방지)
      if (prof.updatedAt && Date.now() - Date.parse(prof.updatedAt) < FRESH_MS) return false;
      if (!rosterTeam) return false;
      const curSchools = (prof.schools ?? []).filter((s) => s.year === season);
      if (curSchools.length === 0) return true; // 당해연도 이력 없음 → 갱신
      // 현행 로스터 소속이 프로필 당해연도 학교에 없으면 = 이적 → 재수집
      return !curSchools.some((s) => s.school === rosterTeam);
    } catch {
      return true; // 손상된 프로필 → 재수집
    }
  };

  const personNos = new Set<string>();
  const checked = new Set<string>();
  for (const g of games) {
    const mark = (name: string, id: string, team: string) => {
      const ros = lookupRoster(roster, name, id.split("_").pop() ?? "", team);
      if (!ros?.personNo || checked.has(ros.personNo)) return;
      checked.add(ros.personNo);
      if (needsUpdate(ros.personNo, ros.team)) personNos.add(ros.personNo);
    };
    for (const b of g.batters) mark(b.name, b.playerId, b.team);
    for (const p of g.pitchers) mark(p.name, p.playerId, p.team);
  }
  if (personNos.size) {
    console.log(`프로필 변동 감지 ${personNos.size}명 (검사 ${checked.size}명)`);
    await collectProfiles(DATA_DIR, [...personNos], years);
  } else {
    console.log(`프로필 변동 없음 (검사 ${checked.size}명) — 수집 스킵`);
  }
}

async function main() {
  const newGameFiles = await collectNewGames();
  const games = readGames(DATA_DIR);
  if (games.length === 0) {
    console.log("경기 데이터가 없어 집계를 건너뜁니다.");
    return;
  }
  const roster = readRoster(DATA_DIR);
  // 시즌별 누적 집계 → data/{year}/ 에 기록 (연도 선택용).
  const bySeason = groupBySeason(games);
  const years = [...bySeason.keys()].sort((a, b) => b - a);
  // 신규 경기 선수 공식기록 증분 수집(있을 때만, 시즌별)
  for (const year of years) {
    const yearGameIds = new Set(bySeason.get(year)!.map((g) => `${g.id}.json`));
    const yearNew = newGameFiles.filter((f) => yearGameIds.has(f));
    await updateOfficialFor(year, yearNew);
  }
  // 선수 프로필 증분 수집(출신학교/수상내역) + 이적 이력 병합 — 집계 전에 수행.
  await updateProfilesFor(games, newGameFiles, years);
  const history = readRosterHistory(DATA_DIR);
  let latest: Meta | undefined;
  for (const year of years) {
    // 공식기록 오버레이(있으면): data/{year}/official.json
    const offFp = path.join(DATA_DIR, String(year), "official.json");
    const official = fs.existsSync(offFp)
      ? (JSON.parse(fs.readFileSync(offFp, "utf8")) as Record<string, { batting?: unknown; pitching?: unknown }>)
      : {};
    const yearGames = bySeason.get(year)!;
    const agg = aggregate(yearGames, SOURCE, roster, official as never, history);
    writeYear(DATA_DIR, year, agg);
    if (latest === undefined) latest = agg.meta;

    // 리그 평균 (전체 시즌 + 학년별) — 시합별은 아래 루프에서 채움. 갱신 시점마다 재계산.
    const averages: LeagueAverages = {
      season: year,
      updatedAt: new Date().toISOString(),
      overall: computeLeagueRates(agg.players),
      grades: {},
      tournaments: {},
    };
    for (const g of ["1", "2", "3"]) {
      const rows = agg.players.filter((p) => p.grade === g);
      if (rows.length) averages.grades![g] = computeLeagueRates(rows);
    }

    // 시즌 personNo → 정규 player.id 맵 (시합별 player.id 재매핑용).
    const personNoToCanonId = new Map<string, string>();
    for (const p of agg.players) if (p.personNo) personNoToCanonId.set(p.personNo, p.id);

    // --- 시합/대회별 집계 → 시합 선택 필터 ---
    const byTitle = new Map<string, typeof yearGames>();
    for (const g of yearGames) {
      const t = g.title?.trim();
      if (!t) continue;
      const arr = byTitle.get(t) ?? [];
      arr.push(g);
      byTitle.set(t, arr);
    }
    const tournamentList: { slug: string; title: string; gameCount: number }[] = [];
    for (const [title, games] of byTitle) {
      const slug = tournamentSlug(title);
      // ⚠ official 오버레이 제외: official 은 시즌 누적 공식기록이라
      //    시합별 aggregate 에 넘기면 박스스코어 합산이 시즌 공식 stats 로
      //    덮어써져 모든 시합 결과가 시즌과 동일해진다.
      const tAgg = aggregate(games, SOURCE, roster, {}, history);

      // 시합별 personNo merge 가 시즌과 다른 대표 id 를 고를 수 있으므로,
      // 시즌의 정규 id 로 강제 매핑한다 (선수 클릭 시 404 방지).
      const idRemap = new Map<string, string>();
      for (const tp of tAgg.players) {
        if (!tp.personNo) continue;
        const canon = personNoToCanonId.get(tp.personNo);
        if (canon && canon !== tp.id) idRemap.set(tp.id, canon);
      }
      const remappedPlayers = tAgg.players.map((tp) => {
        const c = idRemap.get(tp.id);
        return c ? { ...tp, id: c } : tp;
      });
      const remappedMatchups = tAgg.matchups.map((m) => {
        const cb = idRemap.get(m.batterId);
        const cp = idRemap.get(m.pitcherId);
        if (!cb && !cp) return m;
        return { ...m, batterId: cb ?? m.batterId, pitcherId: cp ?? m.pitcherId };
      });

      // 시합별 슬림 records + 시합별 매치업 단일 파일(상대전적 시합 필터용).
      const tDir = path.join(DATA_DIR, String(year), "by-tournament", slug);
      fs.mkdirSync(tDir, { recursive: true });
      fs.writeFileSync(
        path.join(tDir, "records.json"),
        JSON.stringify(remappedPlayers.map(({ gameLog: _gl, ...rest }) => rest))
      );
      fs.writeFileSync(path.join(tDir, "matchups.json"), JSON.stringify(remappedMatchups));
      fs.writeFileSync(path.join(tDir, "meta.json"), JSON.stringify(tAgg.meta));
      averages.tournaments[slug] = { title, rates: computeLeagueRates(tAgg.players) };
      tournamentList.push({ slug, title, gameCount: games.length });
    }
    tournamentList.sort((a, b) => b.gameCount - a.gameCount);
    // 스테일 시합 디렉터리 정리 (시합명 변경/병합으로 slug 가 사라진 경우)
    const btDir = path.join(DATA_DIR, String(year), "by-tournament");
    if (fs.existsSync(btDir)) {
      const live = new Set(tournamentList.map((t) => t.slug));
      for (const d of fs.readdirSync(btDir)) {
        if (!live.has(d)) fs.rmSync(path.join(btDir, d), { recursive: true, force: true });
      }
    }
    fs.writeFileSync(
      path.join(DATA_DIR, String(year), "tournaments.json"),
      JSON.stringify(tournamentList)
    );
    fs.writeFileSync(
      path.join(DATA_DIR, String(year), "averages.json"),
      JSON.stringify(averages)
    );
    console.log(`  · 시합 ${tournamentList.length}개 분리 집계`);
    console.log(
      `✓ ${year} · 경기 ${agg.meta.gameCount} · 선수 ${agg.players.length} · 상대전적 ${agg.matchups.length}`
    );
  }
  if (latest) writeYearsIndex(DATA_DIR, years, latest);
  // 상대 강도 지수(가중치 랭킹용) — records/개별 선수 파일 갱신 후 매 수집마다 재계산.
  buildStrength(DATA_DIR);
  console.log(`✓ 연도 ${years.join(", ")} · 신규 ${newGameFiles.length}경기`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
