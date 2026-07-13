import { useMemo, useState } from "react";
import { useCareerAverages } from "./data";
import { battingAdvanced, dec1, pitchingAdvanced, signed1 } from "./sabermetrics";
import {
  aggregateCareerBatting, aggregateCareerBattingAdvanced,
  aggregateCareerPitching, aggregateCareerPitchingAdvanced,
  careerYearsLabel, type CareerAverages, type CareerSeason,
} from "./career";
import { dec2, inn, int, rate } from "./format";
import type { LeagueAverages } from "./types";

interface Metric {
  id: string;
  label: string;
  total: string;
  value: (season: CareerSeason) => number | undefined;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
  average?: (averages: LeagueAverages) => number | undefined;
}

function MiniBars({ seasons, metric, averages }: { seasons: CareerSeason[]; metric: Metric; averages: CareerAverages }) {
  const rows = seasons
    .map((season) => {
      const value = metric.value(season);
      const leagueFile = averages[season.year];
      const average = leagueFile && metric.average ? metric.average(leagueFile) : undefined;
      return { year: season.year, value, average: average != null && average > 0 ? average : undefined };
    })
    .filter((row): row is { year: number; value: number; average: number | undefined } => row.value != null)
    .map((row) => ({
      ...row,
      display: metric.format(row.value),
      averageDisplay: row.average != null ? metric.format(row.average) : undefined,
    }));
  const observedMax = Math.max(
    0,
    ...rows.flatMap((row) => row.average != null ? [row.value, row.average] : [row.value])
  );
  const scale = observedMax > 0 ? observedMax : 1;
  return (
    <div className="career-bars" role="img" aria-label={rows.map((row) =>
      `${row.year} ${metric.label} ${row.display}${row.averageDisplay ? `, 리그 평균 ${row.averageDisplay}` : ""}`
    ).join(", ")}>
      {rows.map((row) => (
        <div className="career-bar-row" key={row.year}>
          <span className="career-bar-year">{row.year}</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <rect width="100" height="10" rx="5" className="career-bar-track" />
            <rect width={row.value <= 0 ? 0 : Math.max(3, (row.value / scale) * 100)} height="10" rx="5" className="career-bar-fill" />
            {row.average != null && (
              <line
                x1={(row.average / scale) * 100}
                x2={(row.average / scale) * 100}
                y1="-1"
                y2="11"
                className="career-average-marker"
              />
            )}
          </svg>
          <span className="career-bar-values">
            <b>{row.display}</b>
            {row.averageDisplay && <small>평균 {row.averageDisplay}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricPicker({ metrics, selected, onSelect }: { metrics: Metric[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="m-strip career-totals career-totals--selectable">
      {metrics.map((metric) => (
        <button
          type="button"
          className={`cell career-total-button ${selected === metric.id ? "active" : ""}`}
          key={metric.id}
          onClick={() => onSelect(metric.id)}
          aria-pressed={selected === metric.id}
        >
          <span className="k">{metric.label}</span>
          <span className="v">{metric.total}</span>
        </button>
      ))}
    </div>
  );
}

export function CareerPanel({ seasons, kind }: { seasons: CareerSeason[]; kind: "batting" | "pitching" }) {
  const years = useMemo(() => seasons.map((season) => season.year), [seasons]);
  const { data: averagesData } = useCareerAverages(years);
  const averages: CareerAverages = averagesData ?? {};
  const batting = useMemo(() => aggregateCareerBatting(seasons), [seasons]);
  const pitching = useMemo(() => aggregateCareerPitching(seasons), [seasons]);
  const [batMetric, setBatMetric] = useState("avg");
  const [pitMetric, setPitMetric] = useState("era");
  const label = careerYearsLabel(seasons);

  if (kind === "batting" && batting) {
    const advanced = aggregateCareerBattingAdvanced(seasons, averages)!;
    const metrics: Metric[] = [
      { id: "avg", label: "타율", total: rate(batting.avg), value: (s) => s.player.batting?.avg, format: rate, average: (a) => a.overall.avg },
      { id: "ops", label: "OPS", total: rate(advanced.ops), value: (s) => s.player.batting ? battingAdvanced(s.player.batting, null).ops : undefined, format: rate, average: (a) => a.overall.ops },
      { id: "g", label: "경기", total: int(batting.g), value: (s) => s.player.batting?.g, format: int },
      { id: "pa", label: "타석", total: int(batting.pa), value: (s) => s.player.batting?.pa, format: int },
      { id: "ab", label: "타수", total: int(batting.ab), value: (s) => s.player.batting?.ab, format: int },
      { id: "h", label: "안타", total: int(batting.h), value: (s) => s.player.batting?.h, format: int },
      { id: "hr", label: "홈런", total: int(batting.hr), value: (s) => s.player.batting?.hr, format: int },
      { id: "rbi", label: "타점", total: int(batting.rbi), value: (s) => s.player.batting?.rbi, format: int },
      { id: "sb", label: "도루", total: int(batting.sb), value: (s) => s.player.batting?.sb, format: int },
      { id: "bb", label: "볼넷", total: int(batting.bb), value: (s) => s.player.batting?.bb, format: int },
      { id: "woba", label: "wOBA", total: rate(advanced.woba), value: (s) => s.player.batting ? battingAdvanced(s.player.batting, null).woba : undefined, format: rate, average: (a) => a.overall.woba },
    ];
    if (advanced.wrcPlus != null) metrics.push({
      id: "wrcPlus", label: "wRC+", total: int(advanced.wrcPlus),
      value: (s) => s.player.batting ? battingAdvanced(s.player.batting, averages[s.year]?.overall).wrcPlus : undefined,
      format: int, average: () => 100,
    });
    if (advanced.war != null) metrics.push({
      id: "war", label: "WAR", total: signed1(advanced.war),
      value: (s) => s.player.batting ? battingAdvanced(s.player.batting, averages[s.year]?.overall).war : undefined,
      format: signed1,
    });
    const selected = metrics.find((metric) => metric.id === batMetric) ?? metrics[0];
    return (
      <section className="player-section career-panel">
        <div className="career-heading"><h3>통산 타자 기록 <small>항목 선택 시 연도별 비교</small></h3><span>{label} · {seasons.length}시즌</span></div>
        <MetricPicker metrics={metrics} selected={selected.id} onSelect={setBatMetric} />
        <div className="career-chart-title"><h3>연도별 {selected.label}</h3><span>{selected.average && "┃ 리그 평균"}</span></div>
        <MiniBars seasons={seasons} metric={selected} averages={averages} />
        <p className="caption-sm career-note">통산 wRC+는 시즌별 값을 타석 가중평균, WAR는 시즌 합계입니다. 각 시즌은 해당 연도 리그 환경 기준.</p>
      </section>
    );
  }

  if (kind === "pitching" && pitching) {
    const advanced = aggregateCareerPitchingAdvanced(seasons, averages)!;
    const metrics: Metric[] = [
      { id: "era", label: "ERA", total: dec2(pitching.era), value: (s) => s.player.pitching?.era, format: dec2, lowerIsBetter: true, average: (a) => a.overall.era },
      { id: "whip", label: "WHIP", total: dec2(advanced.whip), value: (s) => s.player.pitching?.whip, format: dec2, lowerIsBetter: true, average: (a) => a.overall.whip },
      { id: "g", label: "경기", total: int(pitching.g), value: (s) => s.player.pitching?.g, format: int },
      { id: "w", label: "승", total: int(pitching.w), value: (s) => s.player.pitching?.w, format: int },
      { id: "l", label: "패", total: int(pitching.l), value: (s) => s.player.pitching?.l, format: int },
      { id: "ip", label: "이닝", total: inn(pitching.ip), value: (s) => s.player.pitching?.ip, format: inn },
      { id: "h", label: "피안타", total: int(pitching.h), value: (s) => s.player.pitching?.h, format: int },
      { id: "bb", label: "볼넷", total: int(pitching.bb), value: (s) => s.player.pitching?.bb, format: int },
      { id: "so", label: "탈삼진", total: int(pitching.so), value: (s) => s.player.pitching?.so, format: int },
      { id: "sv", label: "세이브", total: int(pitching.sv), value: (s) => s.player.pitching?.sv, format: int },
      { id: "k9", label: "K/9", total: dec1(advanced.k9), value: (s) => s.player.pitching ? pitchingAdvanced(s.player.pitching, null).k9 : undefined, format: dec1 },
      { id: "kbb", label: "K/BB", total: dec2(advanced.kbb), value: (s) => s.player.pitching ? pitchingAdvanced(s.player.pitching, null).kbb : undefined, format: dec2 },
    ];
    if (advanced.war != null) metrics.push({
      id: "war", label: "WAR", total: signed1(advanced.war),
      value: (s) => s.player.pitching ? pitchingAdvanced(s.player.pitching, averages[s.year]?.overall).war : undefined,
      format: signed1,
    });
    const selected = metrics.find((metric) => metric.id === pitMetric) ?? metrics[0];
    return (
      <section className="player-section career-panel">
        <div className="career-heading"><h3>통산 투수 기록 <small>항목 선택 시 연도별 비교</small></h3><span>{label} · {seasons.length}시즌</span></div>
        <MetricPicker metrics={metrics} selected={selected.id} onSelect={setPitMetric} />
        <div className="career-chart-title"><h3>연도별 {selected.label}</h3><span>{[selected.lowerIsBetter && "낮을수록 좋음", selected.average && "┃ 리그 평균"].filter(Boolean).join(" · ")}</span></div>
        <MiniBars seasons={seasons} metric={selected} averages={averages} />
        <p className="caption-sm career-note">통산 WAR는 시즌 합계이며, 각 시즌은 해당 연도 리그 환경 기준입니다. K/9·K/BB는 합산 원자료로 재계산했습니다.</p>
      </section>
    );
  }
  return <div className="state muted">통산 {kind === "batting" ? "타자" : "투수"} 기록이 없습니다.</div>;
}
