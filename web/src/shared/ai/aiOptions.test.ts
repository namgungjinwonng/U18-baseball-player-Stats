// 경기분석 「분석 옵션」 — 선수 범위 필터·표본·저장 키, 경기 조건(선공/후공·시간대·구장·날씨)과 프롬프트 반영을 검증한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_OPTIONS, filterRecords, optionsKey, optionsSummary, sampleRows, scopePayload, type AiOptions } from "./options";
import { conditionSplits, conditionsPayload, fetchForecast, fieldForVenue, kstStamp, resolveVenue, targetOf, timeBand, upcomingGames, type WeatherMap } from "./conditions";
import { filterFields, sigunguCounts } from "../fieldFilter";
import type { Field } from "../types";
import { buildPayload, buildUserPrompt } from "./prompt";
import { buildPreviousSeasonAnalysis } from "../previousSeasonAnalysis";
import type { Player, ScheduleGame, TeamRosterEntry } from "../types";

const opt = (p: Partial<AiOptions>): AiOptions => ({ ...DEFAULT_OPTIONS, ...p });

// 저장 키·요약 — 기본값은 빈 키(옵션 이전 저장 분석 유지), 학년 순서와 상관없이 같은 키
assert.equal(optionsKey(DEFAULT_OPTIONS), "");
assert.equal(optionsKey(opt({ excludeGrades: ["3", "1"] })), optionsKey(opt({ excludeGrades: ["1", "3"] })));
assert.notEqual(optionsKey(opt({ conditions: true, gameKind: "practice", first: "a" })), optionsKey(opt({ conditions: true, gameKind: "practice", first: "b" })));
assert.equal(optionsSummary(DEFAULT_OPTIONS), "전체 선수 · 경기 조건 꺼짐");
assert.equal(optionsSummary(opt({ excludeGrades: ["3"], excludeMovedOut: true, conditions: true })), "3학년·이적 제외 · 경기 조건 켜짐");

// 선수 범위 — 학년, 전학 간 선수(옛 학교 moved_to)만 제외. 전학 온 선수(새 학교 항목)는 남는다.
const pl = (name: string, team: string, grade: string, personNo: string, pa = 10, ip = 0): Player => ({
  id: `${team}_${name}`, name, team, position: "", grade, personNo, season: 2026,
  batting: { pa } as Player["batting"], pitching: ip ? ({ ip } as Player["pitching"]) : undefined,
});
const recs = [
  pl("삼학년", "경기상업고", "3", "1", 100, 20.1), pl("이학년", "경기상업고", "2", "2", 50),
  pl("전학감", "경기상업고", "1", "3", 30), pl("전학옴", "백송고", "1", "4", 40, 5.2), pl("학년없음", "백송고", "", "5", 7),
];
const roster: TeamRosterEntry[] = [
  { team: "경기상업고", club_idx: "", region: "", manager: "", staff: [], player_count: 2, players: [
    { type: "player", number: "", name: "전학감", position: "", grade: "1", height_weight: "", throw_bat: "", person_no: "3", team: "경기상업고", team_idx: "", region: "", moved_to: "백송고" },
    { type: "player", number: "9", name: "전학옴", position: "", grade: "1", height_weight: "", throw_bat: "", person_no: "4", team: "경기상업고", team_idx: "", region: "", moved_to: "백송고" },
  ] },
];
const names = (rs: Player[]) => rs.map((p) => p.name);
assert.deepEqual(names(filterRecords(recs, roster, opt({ excludeGrades: ["3"] }))), ["이학년", "전학감", "전학옴", "학년없음"]);
assert.deepEqual(names(filterRecords(recs, roster, opt({ excludeMovedOut: true }))), ["삼학년", "이학년", "전학옴", "학년없음"],
  "옛 학교 기록만 빠지고 새 학교(백송고) 기록의 같은 이적 선수는 남는다");
assert.equal(filterRecords(recs, roster, DEFAULT_OPTIONS), recs, "기본값이면 그대로");
const kept = filterRecords(recs, roster, opt({ excludeGrades: ["3"] }));
assert.deepEqual(sampleRows(recs, kept, ["경기상업고", "백송고"]).map((r) => r.text), ["타석 180 → 80 · 이닝 20.1 → 0", "타석 47 → 47 · 이닝 5.2 → 5.2"]);
const scope = scopePayload(opt({ excludeGrades: ["3"], excludeMovedOut: true }), sampleRows(recs, kept, ["경기상업고"]), 2026, false);
assert.deepEqual(scope.제외, ["3학년", "다른 학교로 전학 간 선수(전학 온 선수는 포함)"]);
assert.equal(scope.학년기준, "2026 기록의 학년");

// 시즌 초 참고 분석 — 학년 제외는 전년도 기록의 학년 기준(2027 시즌 초 「2학년 제외」 = 2026 2학년 제외)
const member = (id: string, team: string, grade: string) => ({ type: "player" as const, number: "1", name: id, position: "", grade, height_weight: "", throw_bat: "", person_no: id, team, team_idx: "", region: "" });
const prevRec = (id: string, team: string, grade: string): Player => ({
  id: `${team}_${id}`, name: id, team, position: "", grade, personNo: id, season: 2026,
  batting: { pa: 20, ab: 18, h: 6, avg: .333, obp: .4, slg: .5 } as Player["batting"],
});
const refRoster: TeamRosterEntry[] = [
  { team: "A고", club_idx: "", region: "", manager: "", staff: [], player_count: 2, players: [member("a1", "A고", "3"), member("a2", "A고", "2")] },
  { team: "B고", club_idx: "", region: "", manager: "", staff: [], player_count: 1, players: [member("b1", "B고", "2")] },
];
const prev = [prevRec("a1", "A고", "2"), prevRec("a2", "A고", "1"), prevRec("b1", "B고", "1")];
const refAll = buildPreviousSeasonAnalysis(2027, "A고", "B고", refRoster, prev);
const refNo2 = buildPreviousSeasonAnalysis(2027, "A고", "B고", refRoster, filterRecords(prev, null, opt({ excludeGrades: ["2"] })));
assert.equal(refAll.input!.reference!.teams[0].matchedCount, 2);
assert.equal(refNo2.input!.reference!.teams[0].matchedCount, 1, "2026 2학년(현재 3학년) a1만 빠진다");

// 경기 조건 — 원정 = 선공(초공), 홈 = 후공(말공), 시간대·구장·날씨 구간
const game = (idx: string, date: string, time: string, venue: string, away: [string, number], home: [string, number], status = "완료"): ScheduleGame => ({
  game_idx: idx, title: "t", date, time, venue, round: "", status,
  away: { name: away[0], score: away[1] } as ScheduleGame["away"], home: { name: home[0], score: home[1] } as ScheduleGame["home"],
});
const games = [
  game("1", "2026-04-01", "09:30", "목동야구장", ["강릉고", 5], ["원주고", 2]),
  game("2", "2026-04-08", "12:00", "신월 야구공원", ["원주고", 3], ["강릉고", 4]),
  game("3", "2026-05-01", "14:30", "목동야구장", ["강릉고", 1], ["덕수고", 6]),
  game("4", "2026-11-01", "10:00", "목동야구장", ["원주고", 0], ["강릉고", 0], "예정"),
];
const weather: WeatherMap = { "1": { t: 8, p: 0, w: 2 }, "2": { t: 15, p: 2.5, w: 1 }, "3": { t: 22, p: 0, w: 3 } };
assert.equal(timeBand("09:30"), "오전(12시 전)");
assert.equal(timeBand("12:00"), "낮(12~13시)");
assert.equal(timeBand("14:30"), "오후(14시 이후)");
// 승패와 함께 평균 득점·실점 — 날씨·시간대가 공격·수비에 준 영향을 읽을 수 있게 한다.
const s = conditionSplits(games, "강릉고", weather, ["목동야구장"]);
assert.equal(s.완료경기, 3);
assert.equal(s.전체, "2승 1패(3경기) · 평균 득점 3.3 실점 3.7");
assert.deepEqual(s["선공/후공"], { "선공(원정)": "1승 1패(2경기) · 평균 득점 3.0 실점 4.0", "후공(홈)": "1승 0패(1경기) · 평균 득점 4.0 실점 3.0" });
assert.deepEqual(s.시간대, { "오전(12시 전)": "1승 0패(1경기) · 평균 득점 5.0 실점 2.0", "낮(12~13시)": "1승 0패(1경기) · 평균 득점 4.0 실점 3.0", "오후(14시 이후)": "0승 1패(1경기) · 평균 득점 1.0 실점 6.0" });
assert.equal(s.이구장, "1승 1패(2경기) · 평균 득점 3.0 실점 4.0");
assert.deepEqual(s.날씨별, {
  "10℃ 미만": "1승 0패(1경기) · 평균 득점 5.0 실점 2.0", "10~20℃": "1승 0패(1경기) · 평균 득점 4.0 실점 3.0", "20℃ 이상": "0승 1패(1경기) · 평균 득점 1.0 실점 6.0",
  "비(1mm 이상)": "1승 0패(1경기) · 평균 득점 4.0 실점 3.0", "비 없음": "1승 1패(2경기) · 평균 득점 3.0 실점 4.0",
});
assert.equal(conditionSplits(games, "강릉고", null).날씨별, undefined, "날씨 자료가 없으면 날씨별 성적을 넣지 않는다");

assert.deepEqual(upcomingGames(games, "강릉고", "원주고").map((g) => g.game_idx), ["4"]);
assert.deepEqual(targetOf(opt({ conditions: true, gameIdx: "4" }), games, "강릉고", "원주고"),
  { kind: "공식경기", date: "2026-11-01", time: "10:00", venue: "목동야구장", first: "원주고", second: "강릉고" });
assert.deepEqual(targetOf(opt({ conditions: true, gameKind: "practice", first: "a", start: "2026-11-02T09:00" }), games, "강릉고", "원주고"),
  { kind: "연습경기", date: "2026-11-02", time: "09:00", venue: undefined, first: "강릉고", second: "원주고" });

// 구장 — 연습경기는 야구장 현황 ID 로 고르고, 예보는 그 항목의 실제 좌표로 받는다.
const fld = (id: string, name: string, kind: Field["kind"], sido: string, sigungu: string, lat: number, lon: number, approx?: boolean): Field => ({ id, name, kind, sido, sigungu, lat, lon, ...(approx ? { approx } : {}) });
const fields = [
  fld("kbsa:1", "강릉고등학교", "고등학교", "강원", "강릉시", 37.77, 128.9),
  fld("venue:목동야구장", "목동야구장", "공식경기 구장", "서울", "양천구", 37.5302, 126.8814),
  fld("pro:인천SSG랜더스필드", "인천SSG랜더스필드", "프로야구장", "인천", "미추홀구", 37.4370, 126.6932),
  fld("osm:way/1", "강릉 야구장", "야구장", "강원", "강릉시", 37.75, 128.88, true),
];
const venueMap = { "목동야구장": { lat: 37.52, lon: 126.86, place: "서울 양천구" }, "신월 야구공원": { lat: 37.53, lon: 126.83, place: "서울 양천구" } };
assert.equal(targetOf(opt({ conditions: true, gameKind: "practice", venue: "kbsa:1" }), games, "강릉고", "원주고", fields).venue, "강릉고등학교");
assert.equal(fieldForVenue("목동야구장", fields)?.id, "venue:목동야구장", "같은 이름 ID 우선");
assert.equal(fieldForVenue("SSG 랜더스 필드", fields)?.id, "pro:인천SSG랜더스필드", "띄어쓰기·지역 접두가 달라도 같은 구장");
assert.equal(fieldForVenue("신월 야구공원", fields), undefined);
const practice = opt({ conditions: true, gameKind: "practice", venue: "kbsa:1" });
assert.deepEqual(resolveVenue(practice, targetOf(practice, games, "강릉고", "원주고", fields), fields, venueMap, ["목동야구장"]),
  { name: "강릉고등학교", lat: 37.77, lon: 128.9, precise: true, scheduleNames: [] });
const official = opt({ conditions: true, gameIdx: "4" });
const offPoint = resolveVenue(official, targetOf(official, games, "강릉고", "원주고"), fields, venueMap, ["목동야구장", "신월 야구공원"]);
assert.deepEqual(offPoint, { name: "목동야구장", lat: 37.5302, lon: 126.8814, precise: true, scheduleNames: ["목동야구장"] }, "공식경기도 야구장 현황의 정확한 좌표 우선");
const wolGame = [{ ...games[3], game_idx: "5", venue: "신월 야구공원" }];
const sinwol = opt({ conditions: true, gameIdx: "5" });
assert.deepEqual(resolveVenue(sinwol, targetOf(sinwol, wolGame, "강릉고", "원주고"), fields, venueMap, []),
  { name: "신월 야구공원", lat: 37.53, lon: 126.83, precise: false, scheduleNames: ["신월 야구공원"] }, "없으면 구장표 지역 좌표");

// 구장 필터 — 야구장 현황과 같은 시·도 → 시·군·구 → 이름 검색
assert.deepEqual(filterFields(fields, "", "", ""), [], "지역·검색어가 없으면 전국을 늘어놓지 않는다");
assert.deepEqual(filterFields(fields, "강원", "", "").map((f) => f.id), ["kbsa:1", "osm:way/1"], "고등학교 먼저");
assert.deepEqual(filterFields(fields, "", "", "랜더스").map((f) => f.id), ["pro:인천SSG랜더스필드"]);
assert.deepEqual(sigunguCounts(fields, "강원"), [["강릉시", 2]]);
const cond = conditionsPayload({ target: targetOf(opt({ conditions: true, gameKind: "practice" }), games, "강릉고", "원주고"), forecast: null, games, weather, aName: "강릉고", bName: "원주고", basis: "2026 시즌", venueKnown: false });
assert.equal(cond.대상경기.선공, "모름");
assert.equal(cond.대상경기.날씨, "구장·일시를 몰라 없음");
const teamOf = (p: Record<string, unknown>, t: string) => p[t] as Record<string, unknown>;
assert.deepEqual(teamOf(cond, "강릉고").대상조건, {}, "모르는 조건은 대상조건에 넣지 않는다");

// 대상조건 — 이번 경기와 같은 조건의 성적. 원주고 원정(선공)이면 강릉고는 후공(홈), 강수확률 60% 이상이면 비 오는 경기로 본다.
const forecast = { t: 12, p: 0, pp: 70, w: 2 };
const older = [game("9", "2025-04-01", "10:00", "목동야구장", ["원주고", 1], ["강릉고", 8])];
const full = conditionsPayload({
  target: targetOf(official, games, "강릉고", "원주고"), forecast, games, weather, aName: "강릉고", bName: "원주고", basis: "2026 시즌",
  venueKnown: true, venueNames: ["목동야구장"], history: { games: [...older, ...games], weather: { ...weather, "9": { t: 11, p: 3, w: 1 } }, label: "2025~2026 시즌 공식경기" },
});
assert.deepEqual(full.대상경기.날씨, { 기온: "12.0℃", 강수확률: "70%", 강수량: "0.0mm", 풍속: "2.0m/s", 판정: "10~20℃ · 비 예보" });
// 수집해 둔 공식경기 예보면 언제 수집한 값인지 함께 넘긴다(한국 시간).
assert.equal(kstStamp("2026-10-30T03:05:00.000Z"), "10.30 12:05");
const stored = conditionsPayload({ target: targetOf(official, games, "강릉고", "원주고"), forecast, games, weather, aName: "강릉고", bName: "원주고", basis: "2026 시즌", venueKnown: true, forecastAt: "2026-10-30T03:05:00.000Z" });
assert.equal((stored.대상경기.날씨 as Record<string, string>).예보기준, "10.30 12:05 수집");
assert.deepEqual(teamOf(full, "강릉고").대상조건, {
  "후공(홈)": "1승 0패(1경기) · 평균 득점 4.0 실점 3.0", "오전(12시 전)": "1승 0패(1경기) · 평균 득점 5.0 실점 2.0",
  "구장(목동야구장)": "1승 1패(2경기) · 평균 득점 3.0 실점 4.0", "10~20℃": "1승 0패(1경기) · 평균 득점 4.0 실점 3.0", "비(1mm 이상)": "1승 0패(1경기) · 평균 득점 4.0 실점 3.0",
});
assert.equal((teamOf(full, "원주고").대상조건 as Record<string, string>)["선공(원정)"], "0승 1패(1경기) · 평균 득점 3.0 실점 4.0", "원주고는 선공 성적");
const hist = teamOf(full, "강릉고").통산 as Record<string, unknown>;
assert.equal(hist.기간, "2025~2026 시즌 공식경기");
assert.equal((hist.대상조건 as Record<string, string>)["비(1mm 이상)"], "2승 0패(2경기) · 평균 득점 6.0 실점 2.0", "통산은 지난 시즌 비 경기까지 센다");
assert.equal(teamOf(conditionsPayload({ target: targetOf(official, games, "강릉고", "원주고"), forecast, games, weather, aName: "강릉고", bName: "원주고", basis: "2026 시즌", venueKnown: true, history: { games, weather, label: "x" } }), "강릉고").통산, undefined, "통산 표본이 늘지 않으면 넣지 않는다");

// 프롬프트 — 모든 방향에 선수범위·경기조건. 경기조건이 있으면 분석 전체에 반영하라는 규칙
const input = { aName: "강릉고", bName: "원주고", year: 2026, allYears: false, metrics: {} };
const extra = { scope, conditions: cond };
assert.ok(buildPayload(input, extra, "overall").경기조건 && buildPayload(input, extra, "overall").선수범위);
assert.ok(buildPayload(input, extra, "batting").경기조건, "경기조건은 모든 방향의 전제");
assert.ok(buildPayload(input, extra, "batting").선수범위);
assert.ok(buildUserPrompt(buildPayload(input, extra, "overall")).includes("경기조건 규칙"));
assert.ok(!buildUserPrompt(buildPayload(input, {}, "overall")).includes("경기조건 규칙"));

// 실데이터 — 2026 날씨 파일이 완료 경기 대부분을 덮고, 구장표가 일정 구장을 덮는다.
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../data");
const sched = JSON.parse(fs.readFileSync(path.join(dataDir, "2026/schedule.json"), "utf8")) as { games: ScheduleGame[] };
const realWeather = JSON.parse(fs.readFileSync(path.join(dataDir, "2026/weather.json"), "utf8")) as WeatherMap;
const venues = JSON.parse(fs.readFileSync(path.join(dataDir, "venues.json"), "utf8")) as Record<string, unknown>;
const done = sched.games.filter((g) => g.status === "완료");
assert.ok(done.filter((g) => realWeather[g.game_idx]).length / done.length > 0.95);
assert.ok(sched.games.filter((g) => !venues[g.venue]).length <= 2, "좌표 없는 구장은 「주말리그 권역별 구장」 정도");
const real = conditionSplits(sched.games, "덕수고", realWeather);

// 예보 재사용 — 경기분석에 들어올 때 미리 받은 예보를 AI 요청이 다시 받지 않는다. 취소한 호출만 null, 받은 결과는 남는다.
const realFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = (async () => {
  calls++;
  await new Promise((r) => setTimeout(r, 20));
  return new Response(JSON.stringify({ hourly: { time: [`${today}T10:00`], temperature_2m: [15.5], precipitation_probability: [4], precipitation: [0], wind_speed_10m: [6.7] } }));
}) as typeof fetch;
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const spot = { lat: 37.77, lon: 128.9 };
const cancel = new AbortController();
const early = fetchForecast(spot, today, "10:00", cancel.signal);
cancel.abort();
assert.equal(await early, null, "취소한 호출은 바로 null");
assert.deepEqual(await fetchForecast(spot, today, "10:30"), { t: 15.5, p: 0, pp: 4, w: 6.7 }, "같은 시각(10시) 예보를 끝까지 받아 둔다");
assert.deepEqual(await fetchForecast(spot, today, "10:00", new AbortController().signal), { t: 15.5, p: 0, pp: 4, w: 6.7 });
assert.equal(calls, 1, "미리 받은 예보를 다시 받지 않는다");
globalThis.fetch = realFetch;
console.log(`분석 옵션·경기 조건 테스트 통과 (덕수고 2026: ${JSON.stringify(real["선공/후공"])})`);
