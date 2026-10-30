// 완료 경기의 시작 시각 날씨(기온·강수·풍속·습도)를 Open-Meteo 과거 날씨로 받아 data/{year}/weather.json 에 쌓고,
// 남은 공식경기(16일 안)의 시작 시각 예보를 data/{year}/forecast.json 에 갱신하는 수집기
// 실행: npm run weather (수집 연도 — 예보 포함) · YEARS=2024,2025 npm run weather (지난 시즌 보정 — 예보 없음)
// 구장 위치는 data/venues.json(시·군 단위 좌표). 날씨는 약 10km 격자 값이라 구장 정확한 지점이 아니다.
// 과거 날씨 API는 며칠 늦게 채워지므로 값이 없는 경기는 건너뛰고 다음 실행에서 다시 요청한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectionYear } from "./collectionYear.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

export interface GameWeather { t: number; p: number; w: number; h: number } // 기온 ℃, 강수 mm, 풍속 m/s, 습도 %
interface Venue { lat: number; lon: number; place: string }
interface Game { game_idx: string; date: string; time: string; venue: string; status: string }

// 시작 시각이 속한 정시(09:30 → 09시) 값을 쓴다. 시각 표기가 없으면 낮 12시.
export const startHour = (time: string) => {
  const h = parseInt((time || "").split(":")[0], 10);
  return Number.isFinite(h) && h >= 0 && h < 24 ? h : 12;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
type Hourly = { time: string[] } & Record<string, (number | null)[]>;
async function fetchJsonHourly(base: string, q: URLSearchParams): Promise<Hourly> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    try {
      const res = await fetch(`${base}?${q}`);
      if (!res.ok) throw new Error(`날씨 ${res.status}`);
      return ((await res.json()) as { hourly: Hourly }).hourly;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// 한 구장의 기간 시간별 날씨 → "YYYY-MM-DDTHH" → 날씨
async function fetchHourly(v: Venue, start: string, end: string): Promise<Map<string, GameWeather>> {
  const j = await fetchJsonHourly(ARCHIVE, new URLSearchParams({
    latitude: String(v.lat), longitude: String(v.lon), start_date: start, end_date: end,
    hourly: "temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m",
    wind_speed_unit: "ms", timezone: "Asia/Seoul",
  }));
  const out = new Map<string, GameWeather>();
  j.time.forEach((t, i) => {
    const tt = j.temperature_2m[i], p = j.precipitation[i], w = j.wind_speed_10m[i], h = j.relative_humidity_2m[i];
    if (tt == null || p == null || w == null || h == null) return;
    out.set(t.slice(0, 13), { t: r1(tt), p: r1(p), w: r1(w), h: Math.round(h) });
  });
  return out;
}

export async function collectWeather(dataDir: string, year: number) {
  const schedFp = path.join(dataDir, String(year), "schedule.json");
  if (!fs.existsSync(schedFp)) return console.warn(`⚠ ${year} 일정이 없어 날씨 수집을 건너뜁니다.`);
  const games = (JSON.parse(fs.readFileSync(schedFp, "utf8")) as { games: Game[] }).games;
  const venues = JSON.parse(fs.readFileSync(path.join(dataDir, "venues.json"), "utf8")) as Record<string, Venue>;
  const fp = path.join(dataDir, String(year), "weather.json");
  const saved: Record<string, GameWeather> = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : {};

  const need = games.filter((g) => g.status === "완료" && !saved[g.game_idx] && venues[g.venue]);
  const unknown = [...new Set(games.filter((g) => !venues[g.venue]).map((g) => g.venue))];
  if (unknown.length) console.warn(`  좌표 없는 구장(날씨 제외 — data/venues.json 에 추가 필요): ${unknown.join(", ")}`);
  const byVenue = new Map<string, Game[]>();
  for (const g of need) byVenue.set(g.venue, [...(byVenue.get(g.venue) ?? []), g]);

  let added = 0, pending = 0;
  for (const [venue, list] of byVenue) {
    const dates = list.map((g) => g.date).sort();
    const hourly = await fetchHourly(venues[venue], dates[0], dates[dates.length - 1]);
    for (const g of list) {
      const w = hourly.get(`${g.date}T${String(startHour(g.time)).padStart(2, "0")}`);
      if (w) { saved[g.game_idx] = w; added++; } else pending++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  fs.writeFileSync(fp, JSON.stringify(saved));
  console.log(`✓ ${year} 날씨: 신규 ${added}경기 · 보류 ${pending}경기(과거 날씨 미반영) · 총 ${Object.keys(saved).length}경기 → data/${year}/weather.json`);
}

// ── 남은 공식경기 예보 ──
export interface GameForecast { t: number; p: number; pp: number | null; w: number; at: string } // 기온 ℃, 강수 mm, 강수확률 %, 풍속 m/s, 값이 바뀐 시각
export const FORECAST_DAYS = 16; // Open-Meteo 예보 범위(오늘 포함)
export const kstToday = (now = Date.now()) => new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const upcoming = (g: Game, today: string) => g.status !== "완료" && g.status !== "취소" && g.date >= today;
export const inForecastRange = (g: Game, today: string) => upcoming(g, today) && g.date <= addDays(today, FORECAST_DAYS - 1);

// 구장 좌표 — 앱(web/src/shared/ai/conditions.ts fieldForVenue)과 같은 규칙: 야구장 현황 항목을 먼저, 없으면 구장표의 시·군 좌표.
interface FieldLite { id: string; name: string; kind: string; lat: number; lon: number }
const venueKey = (s: string) => s.replace(/\s/g, "").replace(/\(.*?\)/g, "");
const VENUE_KINDS = new Set(["공식경기 구장", "프로야구장", "야구장"]);
export function venuePoint(name: string, venues: Record<string, Venue>, fields: FieldLite[]): { lat: number; lon: number } | null {
  const exact = fields.find((f) => f.id === `venue:${name}`);
  if (exact) return exact;
  const k = venueKey(name);
  const hits = k.length < 4 ? [] : fields.filter((f) => VENUE_KINDS.has(f.kind)
    && (venueKey(f.name) === k || venueKey(f.name).endsWith(k) || (k.endsWith(venueKey(f.name)) && venueKey(f.name).length >= 4)));
  if (hits.length === 1) return hits[0];
  return venues[name] ?? null;
}

// 예보 병합 — 끝나지 않은 경기만 새 값으로 바꾸고, 값이 같으면 그대로 둔다(바뀐 시각 유지·파일 변경 없음).
// 끝났거나 취소·날짜가 지난 경기는 빼고(실제 날씨는 weather.json), 이번에 못 받은 남은 경기는 직전 예보를 남긴다.
export function mergeForecasts(prev: Record<string, GameForecast>, games: Game[], fetched: Map<string, Omit<GameForecast, "at">>, today: string, now: string) {
  const live = new Set(games.filter((g) => upcoming(g, today)).map((g) => g.game_idx));
  const out: Record<string, GameForecast> = {};
  let changed = 0;
  for (const [idx, f] of Object.entries(prev)) if (live.has(idx)) out[idx] = f;
  for (const [idx, f] of fetched) {
    if (!live.has(idx)) continue;
    const old = out[idx];
    if (old && old.t === f.t && old.p === f.p && old.pp === f.pp && old.w === f.w) continue;
    out[idx] = { ...f, at: now };
    changed++;
  }
  return { games: out, changed, dropped: Object.keys(prev).filter((idx) => !live.has(idx)).length };
}

export async function collectForecast(dataDir: string, year: number, now = Date.now()) {
  const schedFp = path.join(dataDir, String(year), "schedule.json");
  if (!fs.existsSync(schedFp)) return;
  const games = (JSON.parse(fs.readFileSync(schedFp, "utf8")) as { games: Game[] }).games;
  const venues = JSON.parse(fs.readFileSync(path.join(dataDir, "venues.json"), "utf8")) as Record<string, Venue>;
  const fieldsFp = path.join(dataDir, "fields.json");
  const fields = fs.existsSync(fieldsFp) ? (JSON.parse(fs.readFileSync(fieldsFp, "utf8")) as { fields: FieldLite[] }).fields : [];
  const fp = path.join(dataDir, String(year), "forecast.json");
  const prev: Record<string, GameForecast> = fs.existsSync(fp) ? (JSON.parse(fs.readFileSync(fp, "utf8")) as { games: Record<string, GameForecast> }).games : {};
  const today = kstToday(now);

  // 같은 좌표(구장)끼리 묶어 기간 한 번에 받는다.
  const byPoint = new Map<string, { point: { lat: number; lon: number }; list: Game[] }>();
  const unknown = new Set<string>();
  for (const g of games.filter((x) => inForecastRange(x, today))) {
    const point = venuePoint(g.venue, venues, fields);
    if (!point) { unknown.add(g.venue); continue; }
    const key = `${point.lat},${point.lon}`;
    byPoint.set(key, { point, list: [...(byPoint.get(key)?.list ?? []), g] });
  }
  if (unknown.size) console.warn(`  좌표 없는 구장(예보 제외): ${[...unknown].join(", ")}`);
  const fetched = new Map<string, Omit<GameForecast, "at">>();
  let failed = 0;
  for (const { point, list } of byPoint.values()) {
    const dates = list.map((g) => g.date).sort();
    try {
      const j = await fetchJsonHourly(FORECAST, new URLSearchParams({
        latitude: String(point.lat), longitude: String(point.lon), start_date: dates[0], end_date: dates[dates.length - 1],
        hourly: "temperature_2m,precipitation_probability,precipitation,wind_speed_10m",
        wind_speed_unit: "ms", timezone: "Asia/Seoul",
      }));
      for (const g of list) {
        const i = j.time.findIndex((t) => t.startsWith(`${g.date}T${String(startHour(g.time)).padStart(2, "0")}`));
        const t = j.temperature_2m[i], p = j.precipitation[i], w = j.wind_speed_10m[i], pp = j.precipitation_probability[i];
        if (i >= 0 && t != null && p != null && w != null) fetched.set(g.game_idx, { t: r1(t), p: r1(p), pp: pp == null ? null : Math.round(pp), w: r1(w) });
      }
    } catch (e) {
      failed += list.length; // 직전 예보를 남기고 다음 실행에서 다시 받는다
      console.warn(`  예보 실패(${list[0].venue}): ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  const merged = mergeForecasts(prev, games, fetched, today, new Date(now).toISOString());
  const next = { games: merged.games };
  if (JSON.stringify(next.games) !== JSON.stringify(prev) || !fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(next));
  console.log(`✓ ${year} 예보: 대상 ${[...byPoint.values()].reduce((n, x) => n + x.list.length, 0)}경기 · 바뀜 ${merged.changed} · 지난 경기 정리 ${merged.dropped} · 실패 ${failed} → data/${year}/forecast.json`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("weather.ts")) {
  const years = process.env.YEARS
    ? process.env.YEARS.split(",").map((y) => parseInt(y, 10)).filter(Boolean)
    : [collectionYear()];
  (async () => {
    for (const y of years) await collectWeather(DATA_DIR, y);
    if (years.includes(collectionYear())) await collectForecast(DATA_DIR, collectionYear());
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
