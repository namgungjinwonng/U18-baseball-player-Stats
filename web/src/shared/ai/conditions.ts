// AI 경기분석 「경기 조건」 — 일정(원정=선공·홈=후공, 시작 시간, 구장)과 지난 경기 날씨로 팀별 조건 성적과 대상 경기 정보를 만든다
import type { Field, ScheduleGame } from "../types";
import { teamGames, teamKey } from "../versus";
import type { AiOptions } from "./options";

export interface Weather { t: number; p: number; w: number; h?: number } // 기온 ℃, 강수 mm, 풍속 m/s, 습도 %
export type WeatherMap = Record<string, Weather>; // game_idx → 시작 시각 날씨 (data/{year}/weather.json)
export interface Venue { lat: number; lon: number; place: string }
export type VenueMap = Record<string, Venue>; // 구장 이름 → 시·군 좌표 (data/venues.json)

const hourOf = (time?: string) => {
  const h = parseInt((time || "").split(":")[0], 10);
  return Number.isFinite(h) && h >= 0 && h < 24 ? h : null;
};
export const timeBand = (time?: string) => {
  const h = hourOf(time);
  return h == null ? null : h < 12 ? "오전(12시 전)" : h < 14 ? "낮(12~13시)" : "오후(14시 이후)";
};
export const tempBand = (t: number) => (t < 10 ? "10℃ 미만" : t < 20 ? "10~20℃" : "20℃ 이상");
const RAIN_MM = 1; // 시작 시각 1시간 강수 1mm 이상 = 비
const RAIN = "비(1mm 이상)", DRY = "비 없음";
const RAIN_CHANCE = 60; // 예보 강수확률이 이 이상이면 비 오는 경기로 본다
const SIDE = ["선공(원정)", "후공(홈)"], BANDS = ["오전(12시 전)", "낮(12~13시)", "오후(14시 이후)"];
const WEATHER = ["10℃ 미만", "10~20℃", "20℃ 이상", RAIN, DRY];

type Tally = { w: number; l: number; d: number; rs: number; ra: number };
const add = (m: Map<string, Tally>, key: string, outcome: string, rs: number, ra: number) => {
  const t = m.get(key) ?? { w: 0, l: 0, d: 0, rs: 0, ra: 0 };
  if (outcome === "승") t.w++; else if (outcome === "패") t.l++; else t.d++;
  t.rs += rs; t.ra += ra;
  m.set(key, t);
};
// 예: "9승 4패(13경기) · 평균 득점 6.2 실점 3.1" — 평균은 프롬프트가 그대로 인용할 수 있게 문자열에 넣는다.
const text = (t?: Tally) => {
  if (!t) return "경기 없음";
  const n = t.w + t.l + t.d;
  return `${t.w}승 ${t.l}패${t.d ? ` ${t.d}무` : ""}(${n}경기) · 평균 득점 ${(t.rs / n).toFixed(1)} 실점 ${(t.ra / n).toFixed(1)}`;
};
const obj = (m: Map<string, Tally>, order: string[]) =>
  Object.fromEntries(order.filter((k) => m.has(k)).map((k) => [k, text(m.get(k))]));

// 한 학교의 완료 경기를 조건별로 센다. 선공 = 원정(초공), 후공 = 홈(말공) — 박스스코어로 확인한 표기 관례.
// venueNames = 대상 구장으로 볼 일정상 구장 이름들(같은 구장의 표기 차이 포함).
function tally(games: ScheduleGame[], team: string, weather: WeatherMap | null, venueNames: string[]) {
  const done = teamGames(games, team).filter((g) => g.outcome);
  const m = new Map<string, Tally>();
  let withWeather = 0;
  for (const g of done) {
    const o = g.outcome!, rs = g.me.score ?? 0, ra = g.opp.score ?? 0;
    add(m, "전체", o, rs, ra);
    add(m, teamKey(g.game.away.name) === teamKey(team) ? SIDE[0] : SIDE[1], o, rs, ra);
    const b = timeBand(g.game.time);
    if (b) add(m, b, o, rs, ra);
    if (venueNames.includes(g.game.venue)) add(m, "이구장", o, rs, ra);
    const w = weather?.[g.game.game_idx];
    if (w) {
      withWeather++;
      add(m, tempBand(w.t), o, rs, ra);
      add(m, w.p >= RAIN_MM ? RAIN : DRY, o, rs, ra);
    }
  }
  return { m, done: done.length, withWeather };
}

export function conditionSplits(games: ScheduleGame[], team: string, weather: WeatherMap | null, venueNames: string[] = []) {
  return formatSplits(tally(games, team, weather, venueNames), weather, venueNames);
}
function formatSplits({ m, done, withWeather }: ReturnType<typeof tally>, weather: WeatherMap | null, venueNames: string[]) {
  return {
    완료경기: done,
    전체: text(m.get("전체")),
    "선공/후공": obj(m, SIDE),
    시간대: obj(m, BANDS),
    ...(venueNames.length ? { 이구장: text(m.get("이구장")) } : {}),
    ...(weather ? { 날씨별: obj(m, WEATHER), 날씨자료경기: withWeather } : {}),
  };
}

// 공식경기로 고를 수 있는 두 학교의 경기 — 아직 끝나지 않은 경기만, 가까운 날짜부터.
export function upcomingGames(games: ScheduleGame[], a: string, b: string): ScheduleGame[] {
  const A = teamKey(a), B = teamKey(b);
  return games
    .filter((g) => g.status !== "완료" && g.status !== "취소")
    .filter((g) => { const s = [teamKey(g.away.name), teamKey(g.home.name)]; return s.includes(A) && s.includes(B); })
    .sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`));
}

export interface Target { kind: "공식경기" | "연습경기"; date?: string; time?: string; venue?: string; first?: string; second?: string }
// 연습경기 구장은 야구장 현황의 구장 ID다. fields 를 주면 이름으로 바꾼다.
export function targetOf(o: AiOptions, games: ScheduleGame[], aName: string, bName: string, fields?: Field[]): Target {
  if (o.gameKind === "official") {
    const g = games.find((x) => x.game_idx === o.gameIdx);
    if (!g) return { kind: "공식경기" };
    return { kind: "공식경기", date: g.date, time: g.time, venue: g.venue, first: teamKey(g.away.name), second: teamKey(g.home.name) };
  }
  const [date, time] = o.start ? o.start.split("T") : [];
  const first = o.first === "a" ? aName : o.first === "b" ? bName : undefined;
  const venue = o.venue ? fields?.find((f) => f.id === o.venue)?.name : undefined;
  return { kind: "연습경기", date, time, venue, first, second: first ? (first === aName ? bName : aName) : undefined };
}

// 일정의 구장 이름 ↔ 야구장 현황 항목. 「SSG 랜더스 필드」=「인천SSG랜더스필드」처럼 띄어쓰기·지역 접두가 다른 표기를 잇는다.
const venueKey = (s: string) => s.replace(/\s/g, "").replace(/\(.*?\)/g, "");
const VENUE_KINDS = new Set(["공식경기 구장", "프로야구장", "야구장"]);
export function fieldForVenue(name: string, fields: Field[]): Field | undefined {
  const exact = fields.find((f) => f.id === `venue:${name}`);
  if (exact) return exact;
  const k = venueKey(name);
  if (k.length < 4) return undefined;
  const hits = fields.filter((f) => VENUE_KINDS.has(f.kind) && (venueKey(f.name) === k || venueKey(f.name).endsWith(k) || k.endsWith(venueKey(f.name)) && venueKey(f.name).length >= 4));
  return hits.length === 1 ? hits[0] : undefined;
}
// 대상 구장 좌표 — 야구장 현황의 실제 좌표를 먼저, 없으면 구장표의 시·군 좌표. 「이구장」 성적을 셀 일정상 구장 이름도 같이 낸다.
export interface VenuePoint { name: string; lat: number; lon: number; precise: boolean; scheduleNames: string[] }
export function resolveVenue(o: AiOptions, target: Target, fields: Field[], venues: VenueMap, scheduleVenues: string[]): VenuePoint | null {
  const field = o.gameKind === "practice" ? fields.find((f) => f.id === o.venue) : target.venue ? fieldForVenue(target.venue, fields) : undefined;
  if (field) {
    const names = new Set(scheduleVenues.filter((n) => fieldForVenue(n, fields)?.id === field.id));
    if (o.gameKind === "official" && target.venue) names.add(target.venue);
    return { name: field.name, lat: field.lat, lon: field.lon, precise: !field.approx, scheduleNames: [...names] };
  }
  const v = target.venue ? venues[target.venue] : undefined;
  return v && target.venue ? { name: target.venue, lat: v.lat, lon: v.lon, precise: false, scheduleNames: [target.venue] } : null;
}

// 대상 경기 시작 시각 예보(또는 최근 날씨) — Open-Meteo 예보는 과거 92일~앞으로 16일 범위만 준다. 범위 밖·실패면 null.
export interface Forecast { t: number; p: number; pp: number | null; w: number }
// 같은 구장·날짜·시각 예보는 30분 동안 다시 쓴다 — 경기분석에 들어올 때 미리 받아 두면 AI 요청이 기다리지 않는다.
// 요청은 호출한 쪽의 취소와 무관하게 끝까지 받고(다른 호출이 같은 결과를 기다릴 수 있음), 취소한 호출만 먼저 null 로 돌아간다.
const FORECAST_TTL_MS = 30 * 60_000;
const forecastCache = new Map<string, { at: number; pending: Promise<Forecast | null> }>();
export function fetchForecast(v: { lat: number; lon: number }, date: string, time: string | undefined, signal?: AbortSignal): Promise<Forecast | null> {
  const key = `${v.lat},${v.lon},${date},${hourOf(time) ?? 12}`;
  let hit = forecastCache.get(key);
  if (!hit || Date.now() - hit.at > FORECAST_TTL_MS) {
    const pending = requestForecast(v, date, time);
    hit = { at: Date.now(), pending };
    forecastCache.set(key, hit);
    pending.then((f) => { if (!f && forecastCache.get(key)?.pending === pending) forecastCache.delete(key); });
  }
  if (!signal) return hit.pending;
  if (signal.aborted) return Promise.resolve(null);
  return Promise.race([hit.pending, new Promise<null>((resolve) => signal.addEventListener("abort", () => resolve(null), { once: true }))]);
}
async function requestForecast(v: { lat: number; lon: number }, date: string, time: string | undefined): Promise<Forecast | null> {
  const day = Date.parse(`${date}T00:00:00+09:00`), now = Date.now();
  if (!Number.isFinite(day) || day > now + 16 * 864e5 || day < now - 90 * 864e5) return null;
  const q = new URLSearchParams({
    latitude: String(v.lat), longitude: String(v.lon), start_date: date, end_date: date,
    hourly: "temperature_2m,precipitation_probability,precipitation,wind_speed_10m",
    wind_speed_unit: "ms", timezone: "Asia/Seoul",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const j = await res.json() as { hourly: { time: string[]; temperature_2m: (number | null)[]; precipitation_probability: (number | null)[]; precipitation: (number | null)[]; wind_speed_10m: (number | null)[] } };
    const i = j.hourly.time.findIndex((t) => t.endsWith(`T${String(hourOf(time) ?? 12).padStart(2, "0")}:00`));
    const t = j.hourly.temperature_2m[i], p = j.hourly.precipitation[i], w = j.hourly.wind_speed_10m[i], pp = j.hourly.precipitation_probability[i];
    if (i < 0 || t == null || p == null || w == null) return null;
    return { t, p, pp: pp ?? null, w };
  } catch {
    return null;
  }
}
export const forecastText = (f: Forecast) => ({
  기온: `${f.t.toFixed(1)}℃`, 강수확률: f.pp == null ? null : `${f.pp}%`, 강수량: `${f.p.toFixed(1)}mm`, 풍속: `${f.w.toFixed(1)}m/s`,
});
const rainy = (f: Forecast) => f.p >= RAIN_MM || (f.pp ?? 0) >= RAIN_CHANCE;

// 대상 경기와 같은 조건의 성적 줄 — 학교마다 선공/후공이 다르다. 모르는 조건은 넣지 않는다.
function sameConditions(m: Map<string, Tally>, team: string, tg: Target, forecast: Forecast | null, venueKnown: boolean) {
  const keys: string[] = [];
  if (tg.first && tg.second) keys.push(teamKey(team) === teamKey(tg.first) ? SIDE[0] : SIDE[1]);
  const band = timeBand(tg.time);
  if (band) keys.push(band);
  if (venueKnown) keys.push("이구장");
  if (forecast) keys.push(tempBand(forecast.t), rainy(forecast) ? RAIN : DRY);
  return Object.fromEntries(keys.map((k) => [k === "이구장" ? `구장(${tg.venue ?? "대상 구장"})` : k, text(m.get(k))]));
}

export interface ConditionHistory { games: ScheduleGame[]; weather: WeatherMap | null; label: string }
// 프롬프트 「경기조건」 — 대상 경기와 두 학교의 조건별 공식경기 성적. basis 는 성적을 센 시즌(시즌 초 참고 분석이면 전년도).
// history 는 날씨 자료가 있는 시즌 통산(표본을 늘려 기온·비 경향을 본다).
export function conditionsPayload(args: {
  target: Target; forecast: Forecast | null; games: ScheduleGame[]; weather: WeatherMap | null;
  aName: string; bName: string; basis: string; venueKnown: boolean; venueNames?: string[]; history?: ConditionHistory;
}) {
  const { target: tg, aName, bName, forecast } = args;
  const names = args.venueNames ?? [];
  const team = (name: string) => {
    const basis = tally(args.games, name, args.weather, names);
    const out: Record<string, unknown> = { ...formatSplits(basis, args.weather, names), 대상조건: sameConditions(basis.m, name, tg, forecast, names.length > 0) };
    if (args.history) {
      const h = tally(args.history.games, name, args.history.weather, names);
      if (h.done > basis.done) out.통산 = { 기간: args.history.label, ...formatSplits(h, args.history.weather, names), 대상조건: sameConditions(h.m, name, tg, forecast, names.length > 0) };
    }
    return out;
  };
  return {
    안내: `성적은 ${args.basis} 공식경기 기준이고, '통산'은 ${args.history?.label ?? "없음"}이다. 선공=초공(원정), 후공=말공(홈). 날씨는 구장이 있는 곳의 시작 시각 값이다. '대상조건'은 이번 경기와 같은 조건의 성적이다. 경기 수가 5경기 미만인 구간은 참고 수준이다.`,
    대상경기: {
      종류: tg.kind,
      일시: tg.date ? `${tg.date}${tg.time ? ` ${tg.time}` : ""}` : "모름",
      구장: tg.venue ?? "모름",
      선공: tg.first ?? "모름",
      후공: tg.second ?? "모름",
      날씨: forecast ? { ...forecastText(forecast), 판정: `${tempBand(forecast.t)} · ${rainy(forecast) ? "비 예보" : "비 없음"}` } : (tg.venue && args.venueKnown && tg.date ? "예보 범위 밖이거나 받지 못함" : "구장·일시를 몰라 없음"),
    },
    [aName]: team(aName),
    [bName]: team(bName),
  };
}
