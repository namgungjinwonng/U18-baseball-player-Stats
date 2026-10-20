// 선수 상세 상단 요약 — 핵심 5지표 리그 등급(A+~E-, 백분위 기준·비교 기준 전체/같은 학년)과 경기별 누적 추세 꺾은선 (데스크탑·모바일 공용).
import { useCallback, useMemo, useRef, useState } from "react";
import { useAllPlayers, useLeagueAverages } from "./data";
import { emptyFilter, useQualifyContext } from "./filters";
import { rate } from "./format";
import { isQualifiedBat, isQualifiedPit } from "./leaders";
import { BAT_METRICS, PIT_METRICS, cumulativeBatting, pctGrade, percentileRank, topPercent, type GradeLetter } from "./percentile";
import type { GameLogEntry, LeagueRates, Player } from "./types";

// 등급 비교 집단 — 시즌 기록의 규정 충족 선수(학년 지정 시 그 학년만).
// 리그 등급 카드와 선수 상세 상단 핵심 지표가 같은 기준을 쓴다.
export function useGradePopulation(kind: "batting" | "pitching", grade?: string) {
  const { data: records } = useAllPlayers();
  const ctx = useQualifyContext(emptyFilter);
  const qualified = useCallback(
    (p: Player) => (kind === "batting" ? !!p.batting && isQualifiedBat(p, ctx) : !!p.pitching && isQualifiedPit(p, ctx)),
    [kind, ctx]
  );
  const population = useMemo(
    () => (records ? records.filter((p) => qualified(p) && (!grade || p.grade === grade)) : null),
    [records, qualified, grade]
  );
  return { population, qualified };
}

export interface GradeInfo {
  grade: string; // A+ ~ E-
  letter: GradeLetter;
  pct: number; // 백분위
}

// 한 지표의 등급 — 집단이 5명 미만이거나 값이 없으면 null.
export function gradeFor(
  population: Player[] | null,
  player: Player,
  of: (p: Player) => number | undefined,
  lowerIsBetter = false
): GradeInfo | null {
  if (!population || population.length < 5) return null;
  const v = of(player);
  if (v == null || !Number.isFinite(v)) return null;
  const values = population.map(of).filter((x): x is number => x != null && Number.isFinite(x));
  const pct = percentileRank(values, v, lowerIsBetter);
  return pct == null ? null : { ...pctGrade(pct), pct };
}

export function PercentileCard({ player, kind }: { player: Player; kind: "batting" | "pitching" }) {
  const { data: averages } = useLeagueAverages();
  const [base, setBase] = useState<"all" | "grade">("all");
  const metrics = kind === "batting" ? BAT_METRICS : PIT_METRICS;
  const gradeOk = base === "grade" && !!player.grade;
  const { population, qualified } = useGradePopulation(kind, gradeOk ? player.grade : undefined);
  const lg: LeagueRates | undefined = gradeOk ? averages?.grades?.[player.grade!] : averages?.overall;
  if (!population || population.length < 5) return null;

  return (
    <section className="player-section pct-card">
      <div className="pct-card__head">
        <h3>리그 등급</h3>
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
      <div className="pct-card__rows">
      <p className="pct-card__legend">
        A 상위 20% · B 20~40% · C 40~60% · D 60~80% · E 하위 20% <span className="muted">(등급 안에서 +는 위쪽, −는 아래쪽)</span>
      </p>
      {metrics.map((m) => {
        const v = m.of(player);
        const g = gradeFor(population, player, m.of, m.lowerIsBetter);
        const avg = lg?.[m.key];
        if (v == null || !g) return null;
        const { grade, letter, pct } = g;
        return (
          <div key={m.key} className={`pct-row pct-row--${letter}`}>
            <span className="pct-row__label">
              {m.label}
              {avg != null && <small>평균 {m.format(avg)}</small>}
            </span>
            <span className="pct-row__track">
              <span className="pct-row__fill" style={{ width: `${pct}%` }} />
              <span className="pct-row__bubble" style={{ left: `${pct}%` }} title={`백분위 ${pct}`}>{grade}</span>
            </span>
            <span className="pct-row__value">
              {m.format(v)}
              <small>상위 {topPercent(pct)}%</small>
            </span>
          </div>
        );
      })}
      </div>
    </section>
  );
}

const W = 320;
const H = 150;
const PAD = { l: 34, r: 10, t: 10, b: 20 };

// 경기별 누적 타율·OPS 꺾은선 (인라인 SVG — 차트 라이브러리 없이).
// 지점을 누르거나 좌우로 끌면(마우스는 올리기만 해도) 가장 가까운 경기의 기록과 그 시점 누적값을 보여 준다.
export function TrendChart({ log, lg }: { log: GameLogEntry[]; lg?: LeagueRates | null }) {
  const [metric, setMetric] = useState<"avg" | "ops">("avg");
  const [last, setLast] = useState<0 | 10 | 5>(0);
  const [sel, setSel] = useState<number | null>(null); // 선택한 지점 (null = 최근 경기)
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const total = log.filter((g) => g.bStat).length;
  const points = useMemo(() => cumulativeBatting(log, last || undefined), [log, last]);
  if (total < 3) return null;

  const values = points.map((p) => p[metric]);
  const avg = metric === "avg" ? lg?.avg : lg?.ops;
  const yMax = Math.max(...values, avg ?? 0, metric === "avg" ? 0.3 : 0.8) * 1.1;
  const x = (i: number) => PAD.l + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`).join(" ");
  const lastIndex = points.length - 1;
  const lastPoint = points[lastIndex];
  const md = (d: string) => d.slice(5).replace("-", ".");
  const ticks = [0, yMax / 2, yMax];
  const label = metric === "avg" ? "타율" : "OPS";

  // 포인터 위치(화면 좌표) → 가장 가까운 지점
  const pick = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || points.length < 2) return;
    const sx = ((clientX - box.left) / box.width) * W;
    const ratio = (sx - PAD.l) / (W - PAD.l - PAD.r);
    setSel(Math.max(0, Math.min(lastIndex, Math.round(ratio * lastIndex))));
  };
  // 구간이 줄면 이전 선택이 범위를 벗어날 수 있다 — 그때는 최근 경기를 보여 준다.
  const shown = sel != null && sel <= lastIndex ? sel : lastIndex;
  const cur = points[shown];

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
          <button key={n} type="button" className={`trend__chip ${last === n ? "active" : ""}`} disabled={n > 0 && total < n} onClick={() => { setLast(n); setSel(null); }}>
            {n === 0 ? `전체 ${total}경기` : `최근 ${n}경기`}
          </button>
        ))}
      </div>
      {/* 선택한 경기 기록 — 높이를 고정해 드래그 중 그래프가 흔들리지 않게 한다 */}
      <div className="trend__info" aria-live="polite">
        <div className="trend__info-game">
          <b>{md(cur.entry.date)}</b>
          <span>vs {cur.entry.opponent}</span>
          <span className="trend__info-line">{cur.entry.line}</span>
        </div>
        <div className="trend__info-cum">
          {shown === lastIndex && sel !== lastIndex ? "최근 경기까지" : `${cur.games}번째 경기까지`} 누적 {label} <b>{rate(cur[metric])}</b>
          <span className="muted"> · {cur.games}경기 {cur.ab}타수 {cur.h}안타</span>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="trend__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        tabIndex={0}
        aria-label={`경기별 누적 ${label} 그래프 — 좌우 화살표로 경기 이동`}
        onPointerDown={(e) => {
          e.preventDefault(); // 눌러서 고를 때는 포커스 테두리를 띄우지 않는다(키보드 Tab 포커스는 유지)
          dragging.current = true;
          pick(e.clientX);
          try {
            e.currentTarget.setPointerCapture(e.pointerId); // 손가락이 그래프 밖으로 나가도 계속 따라간다
          } catch {
            // 캡처할 수 없는 포인터여도 선택은 이미 반영됐다.
          }
        }}
        onPointerMove={(e) => {
          if (dragging.current || e.pointerType === "mouse") pick(e.clientX);
        }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); setSel(Math.max(0, shown - 1)); }
          if (e.key === "ArrowRight") { e.preventDefault(); setSel(Math.min(lastIndex, shown + 1)); }
        }}
      >
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
        <line x1={x(shown)} x2={x(shown)} y1={PAD.t} y2={H - PAD.b} className={`trend__guide ${shown !== sel ? "is-idle" : ""}`} />
        <path d={path} className="trend__line" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p[metric])} r={2} className="trend__dot" />
        ))}
        <circle cx={x(shown)} cy={y(cur[metric])} r={5} className="trend__sel" />
        <text x={PAD.l} y={H - 4} className="trend__tick">{md(points[0].date)}</text>
        <text x={W - PAD.r} y={H - 4} className="trend__tick" textAnchor="end">{md(lastPoint.date)}</text>
      </svg>
      <p className="caption muted">그래프를 누르거나 좌우로 끌면 경기별 기록을 볼 수 있어요 · 점 하나 = 한 경기까지의 누적값</p>
    </section>
  );
}
