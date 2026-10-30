// 남은 공식경기 예보 — 예보 범위(16일)·구장 좌표 규칙·끝나지 않은 경기만 갱신하는 병합 규칙 검증
import assert from "node:assert/strict";
import { FORECAST_DAYS, inForecastRange, kstToday, mergeForecasts, venuePoint, type GameForecast } from "./weather.js";

const game = (idx: string, date: string, status = "예정", venue = "목동야구장") => ({ game_idx: idx, date, time: "10:00", venue, status });
const today = "2026-10-30";

// 예보 범위 — 오늘부터 16일치, 끝났거나 취소된 경기와 지난 날짜는 제외
assert.equal(FORECAST_DAYS, 16);
assert.ok(inForecastRange(game("1", "2026-10-30"), today));
assert.ok(inForecastRange(game("2", "2026-11-14"), today), "오늘 포함 16일째");
assert.ok(!inForecastRange(game("3", "2026-11-15"), today), "17일째는 아직 범위 밖");
assert.ok(!inForecastRange(game("4", "2026-10-31", "완료"), today));
assert.ok(!inForecastRange(game("5", "2026-10-31", "취소"), today));
assert.ok(!inForecastRange(game("6", "2026-10-29"), today));
assert.equal(kstToday(Date.parse("2026-10-30T16:00:00Z")), "2026-10-31", "한국 시간 자정이 지나면 다음 날");

// 구장 좌표 — 야구장 현황 항목 우선(같은 이름 ID → 띄어쓰기·지역 접두만 다른 이름 1곳), 없으면 구장표
const venues = { 목동야구장: { lat: 37.52, lon: 126.86, place: "서울 양천구" }, "신월 야구공원": { lat: 37.53, lon: 126.83, place: "서울 양천구" } };
const fields = [
  { id: "venue:목동야구장", name: "목동야구장", kind: "공식경기 구장", lat: 37.5302, lon: 126.8814 },
  { id: "pro:인천SSG랜더스필드", name: "인천SSG랜더스필드", kind: "프로야구장", lat: 37.437, lon: 126.6932 },
];
assert.deepEqual(venuePoint("목동야구장", venues, fields), fields[0]);
assert.deepEqual(venuePoint("SSG 랜더스 필드", venues, fields), fields[1]);
assert.deepEqual(venuePoint("신월 야구공원", venues, fields), venues["신월 야구공원"]);
assert.equal(venuePoint("없는 구장", venues, fields), null);

// 병합 — 끝나지 않은 경기만 바뀐 값으로 갱신, 같은 값은 그대로(바뀐 시각 유지), 끝난·취소 경기는 정리, 못 받은 경기는 직전 예보 유지
const old = (t: number, at = "2026-10-29T00:00:00.000Z"): GameForecast => ({ t, p: 0, pp: 10, w: 2, at });
const prev = { a: old(15), b: old(12), c: old(9), d: old(20) };
const games = [game("a", "2026-11-01"), game("b", "2026-11-02"), game("c", "2026-10-31", "완료"), game("d", "2026-11-03"), game("e", "2026-11-04")];
const fetched = new Map([["a", { t: 15, p: 0, pp: 10, w: 2 }], ["b", { t: 13.5, p: 1.2, pp: 70, w: 3 }], ["e", { t: 11, p: 0, pp: null, w: 1 }]]);
const now = "2026-10-30T03:00:00.000Z";
const merged = mergeForecasts(prev, games, fetched, today, now);
assert.deepEqual(merged.games.a, prev.a, "값이 같으면 그대로");
assert.deepEqual(merged.games.b, { t: 13.5, p: 1.2, pp: 70, w: 3, at: now }, "바뀐 경기만 갱신");
assert.equal(merged.games.c, undefined, "끝난 경기는 예보에서 뺀다(실제 날씨는 weather.json)");
assert.deepEqual(merged.games.d, prev.d, "이번에 못 받은 남은 경기는 직전 예보 유지");
assert.deepEqual(merged.games.e, { t: 11, p: 0, pp: null, w: 1, at: now }, "새로 범위에 들어온 경기 추가");
assert.equal(merged.changed, 2);
assert.equal(merged.dropped, 1);
assert.equal(mergeForecasts(merged.games, games, fetched, today, "2026-10-30T06:00:00.000Z").changed, 0, "같은 예보면 다음 실행에서 바뀌는 것 없음");
console.log("남은 공식경기 예보 범위·구장 좌표·바뀐 경기만 갱신 검증 통과");
