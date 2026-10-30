// 분석 옵션에서 고른 경기의 구장·시작 시각 예보를 미리 보여 준다 — 분석을 요청하면 같은 구장 좌표·시각 예보가 프롬프트에 들어간다
import { useEffect, useMemo, useState } from "react";
import { loadVenues, useFields } from "../data";
import type { ScheduleGame } from "../types";
import { targetForecast } from "./buildConditions";
import { forecastText, kstStamp, resolveVenue, targetOf, type Forecast, type VenueMap } from "./conditions";
import type { AiOptions } from "./options";

export function ForecastNote({ opts, upcoming }: { opts: AiOptions; upcoming: ScheduleGame[] }) {
  const { data } = useFields();
  const [venues, setVenues] = useState<VenueMap | null>(null);
  useEffect(() => {
    let alive = true;
    loadVenues().then((v) => alive && setVenues(v));
    return () => { alive = false; };
  }, []);
  const fields = useMemo(() => data?.fields ?? [], [data]);
  const target = targetOf(opts, upcoming, "", "", fields);
  const point = venues && data ? resolveVenue(opts, target, fields, venues, []) : null;
  const key = point && target.date ? `${opts.gameKind}|${opts.gameIdx}|${point.lat},${point.lon},${target.date},${target.time ?? ""}` : "";
  const [result, setResult] = useState<{ key: string; f: Forecast | null; at?: string } | null>(null);
  useEffect(() => {
    if (!key || !point) return;
    const ac = new AbortController();
    targetForecast(opts, target, point, ac.signal).then((r) => !ac.signal.aborted && setResult({ key, f: r.forecast, at: r.at }));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!point) return <p className="ai-options__hint">{opts.gameKind === "practice" ? "구장을 고르면 그 구장 좌표로 예보(16일 이내)를 받아 분석에 넣습니다." : "이 경기 구장의 좌표가 없어 날씨 없이 분석합니다."}</p>;
  if (!target.date) return <p className="ai-options__hint">{point.name} · 경기 시작을 넣으면 예보를 받아 분석에 넣습니다.</p>;
  const where = `${point.name}${point.precise ? "" : "(지역 좌표)"} · ${target.date.slice(5).replace("-", ".")} ${target.time ?? "12:00"}`;
  if (result?.key !== key) return <p className="ai-options__hint">{where} 예보를 받는 중…</p>;
  if (!result.f) return <p className="ai-options__hint">{where} · 예보는 16일 안의 경기만 받을 수 있어 날씨 없이 분석합니다.</p>;
  const t = forecastText(result.f);
  return (
    <p className="ai-options__forecast">
      <b>예보</b> {where} · {t.기온}{t.강수확률 ? ` · 강수확률 ${t.강수확률}` : ""} · 강수 {t.강수량} · 바람 {t.풍속}
      {result.at && <small> · {kstStamp(result.at)} 수집</small>}
    </p>
  );
}
