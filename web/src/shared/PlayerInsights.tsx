// 선수 상세 상단 요약 — 핵심 5지표 리그 백분위 막대(비교 기준 전체/같은 학년)와 경기별 누적 추세 꺾은선 (데스크탑·모바일 공용).
import { useMemo, useState } from "react";
import { useAllPlayers, useLeagueAverages } from "./data";
import { emptyFilter, useQualifyContext } from "./filters";
import { rate } from "./format";
import { isQualifiedBat, isQualifiedPit } from "./leaders";
import { BAT_METRICS, PIT_METRICS, cumulativeBatting, percentileRank } from "./percentile";
import type { GameLogEntry, LeagueRates, Player } from "./types";

// 백분위 색: 0(파랑) → 50(회색) → 100(빨강). Baseball Savant 관례.
function pctColor(p: number): string {
  const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const blue = [17, 81, 255];
  const grey = [170, 170, 172];
  const red = [211, 0, 5];
  const c = p < 50 ? mix(blue, grey, p / 50) : mix(grey, red, (p - 50) / 50);
  return `rgb(${c.join(",")})`;
}

export function PercentileCard({ player, kind }: { player: Player; kind: "batting" | "pitching" }) {
  const { data: records } = useAllPlayers();
  const { data: averages } = useLeagueAverages();
  const ctx = useQualifyContext(emptyFilter);
  const [base, setBase] = useState<"all" | "grade">("all");
  const metrics = kind === "batting" ? BAT_METRICS : PIT_METRICS;
  const qualified = (p: Player) => (kind === "batting" ? !!p.batting && isQualifiedBat(p, ctx) : !!p.pitching && isQualifiedPit(p, ctx));
  const gradeOk = base === "grade" && !!player.grade;

  const population = useMemo(
    () => (records ?? []).filter((p) => qualified(p) && (!gradeOk || p.grade === player.grade)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, ctx, kind, gradeOk, player.grade]
  );
  const lg: LeagueRates | undefined = gradeOk ? averages?.grades?.[player.grade!] : averages?.overall;
  if (!records || population.length < 5) return null;

  return (
    <section className="player-section pct-card">
      <div className="pct-card__head">
        <h3>리그 백분위</h3>
        <div className="career-mode-toggle pct-card__base" role="group" aria-label="비교 기준">
          <button className={base === "all" ? "active" : ""} onClick={() => setBase("all")}>전체</button>
          {player.grade && (
            <button className={base === "grade" ? "active" : ""} onClick={() => setBase("grade")}>{player.grade}학년</button>
          )}
        </div>
      </div>
      <p className="caption muted pct-card__note">
        규정 충족 {kind === "batting" ? "타자" : "투수"} {population.length}명{gradeOk ? `(${player.grade}학년)` : ""} 중 위치 · 시즌 기준
        {!qualified(player) && " · 이 선수는 규정 미달이라 참고용"}
      </p>
      {metrics.map((m) => {
        const v = m.of(player);
        const values = population.map((p) => m.of(p)).filter((x): x is number => x != null);
        const pct = v == null ? null : percentileRank(values, v, m.lowerIsBetter);
        const avg = lg?.[m.key];
        if (v == null || pct == null) return null;
        return (
          <div key={m.key} className="pct-row">
            <span className="pct-row__label">{m.label}</span>
            <span className="pct-row__track">
              <span className="pct-row__fill" style={{ width: `${pct}%`, background: pctColor(pct) }} />
              <span className="pct-row__bubble" style={{ left: `${pct}%`, background: pctColor(pct) }}>{pct}</span>
            </span>
            <span className="pct-row__value">
              {m.format(v)}
              {avg != null && <small>평균 {m.format(avg)}</small>}
            </span>
          </div>
        );
      })}
    </section>
  );
}

const W = 320;
const H = 150;
const PAD = { l: 34, r: 10, t: 10, b: 20 };

// 경기별 누적 타율·OPS 꺾은선 (인라인 SVG — 차트 라이브러리 없이).
export function TrendChart({ log, lg }: { log: GameLogEntry[]; lg?: LeagueRates | null }) {
  const [metric, setMetric] = useState<"avg" | "ops">("avg");
  const [last, setLast] = useState<0 | 10 | 5>(0);
  const total = log.filter((g) => g.bStat).length;
  const points = useMemo(() => cumulativeBatting(log, last || undefined), [log, last]);
  if (total < 3) return null;

  const values = points.map((p) => p[metric]);
  const avg = metric === "avg" ? lg?.avg : lg?.ops;
  const yMax = Math.max(...values, avg ?? 0, metric === "avg" ? 0.3 : 0.8) * 1.1;
  const x = (i: number) => PAD.l + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`).join(" ");
  const lastPoint = points[points.length - 1];
  const md = (d: string) => d.slice(5).replace("-", ".");
  const ticks = [0, yMax / 2, yMax];

  return (
    <section className="player-section trend">
      <div className="pct-card__head">
        <h3>경기별 추세 <small className="muted">누적</small></h3>
        <div className="career-mode-toggle pct-card__base" role="group" aria-label="지표">
          <button className={metric === "avg" ? "active" : ""} onClick={() => setMetric("avg")}>타율</button>
          <button className={metric === "ops" ? "active" : ""} onClick={() => setMetric("ops")}>OPS</button>
        </div>
      </div>
      <div className="trend__range" role="group" aria-label="구간">
        {([0, 10, 5] as const).map((n) => (
          <button key={n} type="button" className={`trend__chip ${last === n ? "active" : ""}`} disabled={n > 0 && total < n} onClick={() => setLast(n)}>
            {n === 0 ? `전체 ${total}경기` : `최근 ${n}경기`}
          </button>
        ))}
      </div>
      <svg className="trend__svg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`경기별 누적 ${metric === "avg" ? "타율" : "OPS"} — 최종 ${rate(lastPoint[metric])}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="trend__grid" />
            <text x={PAD.l - 4} y={y(t) + 3} className="trend__tick" textAnchor="end">{rate(t)}</text>
          </g>
        ))}
        {avg != null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(avg)} y2={y(avg)} className="trend__avg" />
            <text x={PAD.l + 3} y={y(avg) - 3} className="trend__avg-label">리그 {rate(avg)}</text>
          </g>
        )}
        <path d={path} className="trend__line" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p[metric])} r={i === points.length - 1 ? 3.5 : 2} className="trend__dot" />
        ))}
        <text x={PAD.l} y={H - 4} className="trend__tick">{md(points[0].date)}</text>
        <text x={W - PAD.r} y={H - 4} className="trend__tick" textAnchor="end">{md(lastPoint.date)}</text>
      </svg>
      <p className="caption muted">최종 {rate(lastPoint[metric])} · 점 하나 = 한 경기까지의 누적값</p>
    </section>
  );
}
