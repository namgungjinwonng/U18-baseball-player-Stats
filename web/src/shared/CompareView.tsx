// 선수 2~3명 나란히 비교 화면 (데스크탑·모바일 공용) — /compare?k=batting|pitching&ids=a,b,c
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAllPlayers, useLeagueAverages } from "./data";
import { dec2, inn, rate } from "./format";
import { MirrorBars, type MirrorRow } from "./MirrorBars";
import { battingAdvanced, pitchingAdvanced } from "./sabermetrics";
import { compareHref, picksFromQuery, resolvePicks } from "./comparePicks";
import { MAX_COMPARE } from "./RecordsControls";
import { useYear } from "./year";
import type { LeagueRates, Player } from "./types";

type Kind = "batting" | "pitching";

interface Metric {
  key: string;
  label: string;
  of: (p: Player, lg: LeagueRates | null) => number | undefined;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
}

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const d1 = (v: number) => v.toFixed(1);

const BAT: Metric[] = [
  { key: "g", label: "경기", of: (p) => p.batting?.g, format: String },
  { key: "pa", label: "타석", of: (p) => p.batting?.pa, format: String },
  { key: "avg", label: "타율", of: (p) => p.batting?.avg, format: rate },
  { key: "obp", label: "출루율", of: (p) => p.batting?.obp, format: rate },
  { key: "slg", label: "장타율", of: (p) => p.batting?.slg, format: rate },
  { key: "ops", label: "OPS", of: (p) => (p.batting ? p.batting.obp + p.batting.slg : undefined), format: rate },
  { key: "hr", label: "홈런", of: (p) => p.batting?.hr, format: String },
  { key: "rbi", label: "타점", of: (p) => p.batting?.rbi, format: String },
  { key: "sb", label: "도루", of: (p) => p.batting?.sb, format: String },
  { key: "bbPct", label: "볼넷%", of: (p) => (p.batting ? battingAdvanced(p.batting).bbPct : undefined), format: pct1 },
  { key: "kPct", label: "삼진%", of: (p) => (p.batting ? battingAdvanced(p.batting).kPct : undefined), format: pct1, lowerIsBetter: true },
  { key: "woba", label: "wOBA", of: (p) => (p.batting ? battingAdvanced(p.batting).woba : undefined), format: rate },
  { key: "wrc", label: "wRC+", of: (p, lg) => (p.batting ? battingAdvanced(p.batting, lg).wrcPlus : undefined), format: String },
  { key: "war", label: "WAR", of: (p, lg) => (p.batting ? battingAdvanced(p.batting, lg).war : undefined), format: d1 },
];

const PIT: Metric[] = [
  { key: "g", label: "경기", of: (p) => p.pitching?.g, format: String },
  { key: "ip", label: "이닝", of: (p) => p.pitching?.ip, format: inn },
  { key: "era", label: "ERA", of: (p) => p.pitching?.era, format: dec2, lowerIsBetter: true },
  { key: "whip", label: "WHIP", of: (p) => p.pitching?.whip, format: dec2, lowerIsBetter: true },
  { key: "so", label: "탈삼진", of: (p) => p.pitching?.so, format: String },
  { key: "k9", label: "K/9", of: (p) => (p.pitching ? pitchingAdvanced(p.pitching).k9 : undefined), format: d1 },
  { key: "bb9", label: "BB/9", of: (p) => (p.pitching ? pitchingAdvanced(p.pitching).bb9 : undefined), format: d1, lowerIsBetter: true },
  { key: "fip", label: "FIP", of: (p) => (p.pitching ? pitchingAdvanced(p.pitching).fip : undefined), format: dec2, lowerIsBetter: true },
  { key: "war", label: "WAR", of: (p, lg) => (p.pitching ? pitchingAdvanced(p.pitching, lg).war : undefined), format: d1 },
];

// 3명 비교 — 지표별로 가장 좋은 값을 굵게, 막대는 셋 중 최댓값 대비 길이.
function CompareTable({ players, metrics, lg }: { players: Player[]; metrics: Metric[]; lg: LeagueRates | null }) {
  return (
    <div className="stat-table__scroll">
      <table className="stat-table compare-table">
        <thead>
          <tr>
            <th>지표</th>
            {players.map((p) => <th key={p.id}>{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const vals = players.map((p) => m.of(p, lg));
            const nums = vals.filter((v): v is number => v != null);
            const best = nums.length > 1 ? (m.lowerIsBetter ? Math.min(...nums) : Math.max(...nums)) : null;
            const max = Math.max(...nums.map(Math.abs), 0);
            return (
              <tr key={m.key}>
                <td>{m.label}{m.lowerIsBetter && <small className="muted"> ↓</small>}</td>
                {vals.map((v, i) => (
                  <td key={players[i].id} className={v != null && v === best ? "is-better" : ""}>
                    {v == null ? "-" : m.format(v)}
                    {v != null && max > 0 && <span className="compare-table__bar" style={{ width: `${(Math.abs(v) / max) * 100}%` }} />}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CompareView({ wrapClass }: { wrapClass: string }) {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { year } = useYear();
  // 주소의 선수 ID는 고른 시즌 기준이라, 비교 화면에서 시즌을 바꾸면 personNo(pn)로 그 시즌 선수를 다시 찾는다.
  const refs = useMemo(() => picksFromQuery(params, MAX_COMPARE), [params]);
  const { data: records, loading } = useAllPlayers();
  const { data: averages } = useLeagueAverages();
  const lg = averages?.overall ?? null;
  const players = useMemo(() => resolvePicks(refs, records), [refs, records]);
  const missing = loading ? 0 : refs.length - players.length; // 이 시즌 기록이 없는 선수 수
  const canBat = players.length > 0 && players.every((p) => p.batting);
  const canPit = players.length > 0 && players.every((p) => p.pitching);
  const requested = params.get("k") === "pitching" ? "pitching" : "batting";
  const kind: Kind = requested === "pitching" ? (canPit ? "pitching" : "batting") : canBat ? "batting" : "pitching";
  const metrics = kind === "batting" ? BAT : PIT;
  const go = (k: Kind, list: Player[]) => nav(compareHref(k, list), { replace: true });
  const remove = (id: string) => go(kind, players.filter((p) => p.id !== id));

  return (
    <div className={`${wrapClass} compare-page`}>
      <h2 className="heading-xl">선수 비교</h2>
      {loading && <div className="state">불러오는 중…</div>}
      {missing > 0 && (
        <p className="caption compare-missing">고른 선수 중 {missing}명은 {year} 시즌 기록이 없어 비교에서 빠졌습니다.</p>
      )}
      {!loading && players.length < 2 && (
        <p className="state muted">
          {year} 시즌에 비교할 선수가 부족합니다. <Link to="/records">선수 기록</Link>에서 「비교」를 켜고 2~3명을 고르세요.
        </p>
      )}
      {players.length >= 2 && (
        <>
          <div className="compare-heads">
            {players.map((p) => (
              <div key={p.id} className="compare-head">
                <Link to={`/player/${p.id}`} className="compare-head__name">{p.name}</Link>
                <span className="caption muted">{p.team}{p.grade ? ` · ${p.grade}학년` : ""}</span>
                <button type="button" className="link-btn" onClick={() => remove(p.id)} aria-label={`${p.name} 빼기`}>빼기</button>
              </div>
            ))}
          </div>
          <div className="m-tabs" style={{ marginTop: 12 }}>
            {canBat && (
              <button type="button" className={`chip ${kind === "batting" ? "chip--active" : ""}`}
                onClick={() => go("batting", players)}>타자 기록</button>
            )}
            {canPit && (
              <button type="button" className={`chip ${kind === "pitching" ? "chip--active" : ""}`}
                onClick={() => go("pitching", players)}>투수 기록</button>
            )}
          </div>
          <p className="caption muted">{kind === "batting" ? "타자" : "투수"} 시즌 기록 · 좋은 쪽을 진하게 표시</p>
          {players.length === 2 ? (
            <MirrorBars
              aName={players[0].name}
              bName={players[1].name}
              rows={metrics.map<MirrorRow>((m) => ({
                key: m.key,
                label: m.label,
                a: m.of(players[0], lg),
                b: m.of(players[1], lg),
                format: m.format,
                lowerIsBetter: m.lowerIsBetter,
              }))}
            />
          ) : (
            <CompareTable players={players} metrics={metrics} lg={lg} />
          )}
        </>
      )}
    </div>
  );
}
