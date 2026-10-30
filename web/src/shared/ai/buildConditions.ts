// 「경기 조건」 프롬프트 자료를 모으는 비동기 함수 — 지난 경기 날씨·구장 좌표를 읽고 대상 경기 예보를 받는다(AI 요청 때만)
import { loadFields, loadGameWeather, loadVenues } from "../data";
import type { ScheduleGame } from "../types";
import { conditionsPayload, fetchForecast, resolveVenue, targetOf, type ConditionHistory } from "./conditions";
import type { AiOptions } from "./options";

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
  const forecast = v && target.date ? await fetchForecast(v, target.date, target.time, signal) : null;
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
    aName: args.aName, bName: args.bName, basis: args.basis, venueKnown: !!v, venueNames: v?.scheduleNames, history,
  });
}
