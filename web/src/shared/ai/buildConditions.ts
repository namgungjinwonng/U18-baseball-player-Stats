// 「경기 조건」 프롬프트 자료를 모으는 비동기 함수 — 지난 경기 날씨·구장 좌표를 읽고 대상 경기 예보를 받는다(AI 요청 때만)
import { loadFields, loadGameForecast, loadGameWeather, loadVenues } from "../data";
import type { ScheduleGame } from "../types";
import { conditionsPayload, fetchForecast, resolveVenue, targetOf, type ConditionHistory, type Forecast, type Target } from "./conditions";
import type { AiOptions } from "./options";

// 대상 경기 예보 — 공식경기는 수집기가 갱신해 둔 예보를 먼저 쓰고(모두 같은 값), 없으면(수집 뒤 새로 잡힌 경기 등) 직접 받는다.
// 연습경기는 사용자가 고른 구장·시각이라 항상 직접 받는다.
export async function targetForecast(o: AiOptions, target: Target, point: { lat: number; lon: number } | null, signal?: AbortSignal): Promise<{ forecast: Forecast | null; at?: string }> {
  if (o.gameKind === "official" && o.gameIdx && target.date) {
    const stored = (await loadGameForecast(Number(target.date.slice(0, 4))))[o.gameIdx];
    if (stored) { const { at, ...forecast } = stored; return { forecast, at }; }
  }
  return { forecast: point && target.date ? await fetchForecast(point, target.date, target.time, signal) : null };
}

export async function buildConditions(o: AiOptions, args: {
  splitGames: ScheduleGame[]; // 조건별 성적을 셀 공식경기 일정
  splitYear: number; // 그 일정의 시즌(날씨 파일)
  targetGames: ScheduleGame[]; // 대상 경기를 찾을 올해 일정
  aName: string; bName: string; basis: string;
  history?: { games: ScheduleGame[]; years: number[] }; // 통산 성적을 셀 여러 시즌 일정
}, signal?: AbortSignal) {
  const otherYears = (args.history?.years ?? []).filter((y) => y !== args.splitYear);
  const [venues, fieldsData, weather, ...others] = await Promise.all([
    loadVenues(), loadFields(), loadGameWeather(args.splitYear), ...otherYears.map(loadGameWeather),
  ]);
  const fields = fieldsData?.fields ?? [];
  const target = targetOf(o, args.targetGames, args.aName, args.bName, fields);
  const scheduleVenues = [...new Set([...args.splitGames, ...(args.history?.games ?? []), ...args.targetGames].map((g) => g.venue))];
  const v = resolveVenue(o, target, fields, venues, scheduleVenues);
  const { forecast, at: forecastAt } = await targetForecast(o, target, v, signal);
  // 통산은 날씨 파일이 있는 시즌만 센다(날씨 없는 시즌이 섞이면 날씨별 표본 설명이 틀린다).
  const weatherYears = [args.splitYear, ...otherYears].filter((_, i) => Object.keys([weather, ...others][i]).length);
  let history: ConditionHistory | undefined;
  if (args.history && weatherYears.length > 1) {
    const years = new Set(weatherYears.map(String));
    history = {
      games: args.history.games.filter((g) => years.has(g.date.slice(0, 4))),
      weather: Object.assign({}, ...others, weather),
      label: `${Math.min(...weatherYears)}~${Math.max(...weatherYears)} 시즌 공식경기`,
    };
  }
  return conditionsPayload({
    target, forecast, games: args.splitGames, weather: Object.keys(weather).length ? weather : null,
    aName: args.aName, bName: args.bName, basis: args.basis, venueKnown: !!v, venueNames: v?.scheduleNames, history, forecastAt,
  });
}
