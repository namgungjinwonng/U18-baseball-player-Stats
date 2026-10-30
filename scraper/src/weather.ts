// 완료 경기의 시작 시각 날씨(기온·강수·풍속·습도)를 Open-Meteo 과거 날씨로 받아 data/{year}/weather.json 에 쌓는 수집기
// 실행: npm run weather (수집 연도) · YEARS=2024,2025 npm run weather (지난 시즌 보정)
// 구장 위치는 data/venues.json(시·군 단위 좌표). 날씨는 약 10km 격자 값이라 구장 정확한 지점이 아니다.
// 과거 날씨 API는 며칠 늦게 채워지므로 값이 없는 경기는 건너뛰고 다음 실행에서 다시 요청한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectionYear } from "./collectionYear.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

export interface GameWeather { t: number; p: number; w: number; h: number } // 기온 ℃, 강수 mm, 풍속 m/s, 습도 %
interface Venue { lat: number; lon: number; place: string }
interface Game { game_idx: string; date: string; time: string; venue: string; status: string }

// 시작 시각이 속한 정시(09:30 → 09시) 값을 쓴다. 시각 표기가 없으면 낮 12시.
export const startHour = (time: string) => {
  const h = parseInt((time || "").split(":")[0], 10);
  return Number.isFinite(h) && h >= 0 && h < 24 ? h : 12;
};

// 한 구장의 기간 시간별 날씨 → "YYYY-MM-DDTHH" → 날씨
async function fetchHourly(v: Venue, start: string, end: string): Promise<Map<string, GameWeather>> {
  const q = new URLSearchParams({
    latitude: String(v.lat), longitude: String(v.lon), start_date: start, end_date: end,
    hourly: "temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m",
    wind_speed_unit: "ms", timezone: "Asia/Seoul",
  });
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    try {
      const res = await fetch(`${ARCHIVE}?${q}`);
      if (!res.ok) throw new Error(`날씨 ${res.status}`);
      const j = await res.json() as { hourly: { time: string[]; temperature_2m: (number | null)[]; precipitation: (number | null)[]; wind_speed_10m: (number | null)[]; relative_humidity_2m: (number | null)[] } };
      const out = new Map<string, GameWeather>();
      j.hourly.time.forEach((t, i) => {
        const tt = j.hourly.temperature_2m[i], p = j.hourly.precipitation[i], w = j.hourly.wind_speed_10m[i], h = j.hourly.relative_humidity_2m[i];
        if (tt == null || p == null || w == null || h == null) return;
        out.set(t.slice(0, 13), { t: Math.round(tt * 10) / 10, p: Math.round(p * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(h) });
      });
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
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

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("weather.ts")) {
  const years = process.env.YEARS
    ? process.env.YEARS.split(",").map((y) => parseInt(y, 10)).filter(Boolean)
    : [collectionYear()];
  (async () => {
    for (const y of years) await collectWeather(DATA_DIR, y);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
