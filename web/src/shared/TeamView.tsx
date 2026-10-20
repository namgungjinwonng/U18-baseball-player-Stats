// 팀 상세 화면 (데스크탑·모바일 공용) — /team/:name: 시즌 성적·팀 타격/투구·주요 선수·일정, 대전 모드 입구.
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAllPlayers, useLeagueAverages, useSchedule, useStrength, useTeams } from "./data";
import { useQualifyContext } from "./filters";
import { dec2, rate } from "./format";
import { heatColor, heatScore } from "./heat";
import { kbsaBoxScoreUrl } from "./kbsa";
import { sameTeam, teamGames, teamKey, teamRecord, teamTotals } from "./versus";
import { TopPlayersSection } from "./TopPlayers";
import { useYear } from "./year";

const shortTitle = (t: string) => (t || "").replace(/^\s*\d{4}\s*/, "").trim();

// 팀 지표 한 칸 — 리그 평균과 비교해 배경색을 입힌다.
function Cell({ k, v, avg, lowerIsBetter, fmt }: {
  k: string;
  v: number | undefined;
  avg?: number;
  lowerIsBetter?: boolean;
  fmt: (x: number) => string;
}) {
  return (
    <div className="cell" style={{ background: avg != null ? heatColor(heatScore(v, avg, lowerIsBetter)) : undefined }}>
      <div className="k">{k}</div>
      <div className="v">{v == null ? "-" : fmt(v)}</div>
      {avg != null && <div className="team-cell__avg">리그 {fmt(avg)}</div>}
    </div>
  );
}

export function TeamView({ wrapClass }: { wrapClass: string }) {
  const { name = "" } = useParams();
  const nav = useNavigate();
  const team = teamKey(decodeURIComponent(name));
  const { year } = useYear();
  const teams = useTeams();
  const schedule = useSchedule();
  const records = useAllPlayers();
  const averages = useLeagueAverages();
  const strength = useStrength();
  const ctx = useQualifyContext({ region: "", team: "", grade: "", tournament: "" });

  const roster = teams.data?.find((t) => sameTeam(t.team, team));
  const games = useMemo(
    () => (schedule.data?.year === year ? teamGames(schedule.data.games, team) : []),
    [schedule.data, year, team]
  );
  const rec = useMemo(
    () => (schedule.data?.year === year ? teamRecord(schedule.data.games, team) : null),
    [schedule.data, year, team]
  );
  const totals = useMemo(() => (records.data ? teamTotals(records.data, team) : null), [records.data, team]);
  const topTeams = useMemo(() => [team], [team]);
  const str = useMemo(
    () => Object.entries(strength.data?.teams ?? {}).find(([t]) => sameTeam(t, team))?.[1],
    [strength.data, team]
  );
  // 상대 학교 선택지 — 이번 시즌 상대한 학교를 경기 수 순으로.
  const opponents = useMemo(() => {
    const count = new Map<string, number>();
    for (const g of games) count.set(teamKey(g.opp.name), (count.get(teamKey(g.opp.name)) ?? 0) + 1);
    return [...count.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "ko"));
  }, [games]);

  const lg = averages.data?.overall;
  const loading = schedule.loading || records.loading || teams.loading;
  if (!loading && !roster && games.length === 0 && !totals) {
    return <div className={wrapClass}><div className="state">{team}의 {year} 시즌 기록이 없습니다.</div></div>;
  }
  const pct = rec && rec.w + rec.l ? (rec.w / (rec.w + rec.l)).toFixed(3) : "-";

  return (
    <div className={`${wrapClass} team-page`}>
      <h2 className="heading-xl" style={{ marginBottom: 0 }}>{team}</h2>
      <div className="player-meta-line">
        {roster?.region && <span>{roster.region}</span>}
        {roster?.manager && <span>감독 {roster.manager}</span>}
        {roster && <span>선수 {roster.player_count}명</span>}
        {roster && <Link to={`/players?team=${encodeURIComponent(roster.team)}`}>선수현황 ›</Link>}
      </div>

      <div className="team-versus">
        <label className="caption" htmlFor="team-versus-select">상대 학교 선택 → 학교 대전</label>
        <select
          id="team-versus-select"
          className="m-select"
          value=""
          onChange={(e) => e.target.value && nav(`/versus?a=${encodeURIComponent(team)}&b=${encodeURIComponent(e.target.value)}`)}
        >
          <option value="">{opponents.length ? `상대한 학교 ${opponents.length}곳` : "상대 학교 없음"}</option>
          {opponents.map(([opp, n]) => (
            <option key={opp} value={opp}>{opp} · {n}경기</option>
          ))}
        </select>
        <Link to={`/versus?a=${encodeURIComponent(team)}`} className="link-btn">다른 학교 고르기 ›</Link>
      </div>

      {loading && <div className="state">불러오는 중…</div>}

      {rec && (
        <section className="player-section">
          <h3>{year} 시즌 성적</h3>
          <div className="m-kpi">
            <div className="m-kpi__cell"><span className="m-kpi__k">전적</span><span className="m-kpi__v">{rec.w}-{rec.l}{rec.d ? `-${rec.d}` : ""}</span></div>
            <div className="m-kpi__cell"><span className="m-kpi__k">승률</span><span className="m-kpi__v">{pct}</span></div>
            <div className="m-kpi__cell"><span className="m-kpi__k">득점</span><span className="m-kpi__v">{rec.rf}</span></div>
            <div className="m-kpi__cell"><span className="m-kpi__k">실점</span><span className="m-kpi__v">{rec.ra}</span></div>
          </div>
        </section>
      )}

      {totals && (
        <>
          <section className="player-section">
            <h3>팀 타격</h3>
            <div className="m-strip team-strip">
              <Cell k="타율" v={totals.batting.avg} avg={lg?.avg} fmt={rate} />
              <Cell k="출루율" v={totals.batting.obp} avg={lg?.obp} fmt={rate} />
              <Cell k="장타율" v={totals.batting.slg} avg={lg?.slg} fmt={rate} />
              <Cell k="OPS" v={totals.batting.ops} avg={lg?.ops} fmt={rate} />
              <Cell k="홈런" v={totals.batting.hr} fmt={String} />
              <Cell k="도루" v={totals.batting.sb} fmt={String} />
              {str && <Cell k="타선 강도지수" v={str.bat} avg={1} fmt={dec2} />}
            </div>
          </section>
          <section className="player-section">
            <h3>팀 투구</h3>
            <div className="m-strip team-strip">
              <Cell k="ERA" v={totals.pitching.era} avg={lg?.era} lowerIsBetter fmt={dec2} />
              <Cell k="WHIP" v={totals.pitching.whip} avg={lg?.whip} lowerIsBetter fmt={dec2} />
              <Cell k="K/9" v={totals.pitching.k9} avg={lg?.k9} fmt={(x) => x.toFixed(1)} />
              <Cell k="BB/9" v={totals.pitching.bb9} avg={lg?.bb9} lowerIsBetter fmt={(x) => x.toFixed(1)} />
              {str && <Cell k="마운드 강도지수" v={str.pit} avg={1} fmt={dec2} />}
            </div>
            <p className="caption muted">팀 비율은 선수 기록 합산 원자료로 재계산 · 파랑 = 리그 평균보다 좋음, 빨강 = 나쁨</p>
          </section>
        </>
      )}

      <TopPlayersSection teams={topTeams} records={records.data} ctx={ctx} title="주요 선수" />
      <Link className="link-btn" to={`/records?s=${encodeURIComponent(roster?.team ?? team)}`}>
        {team} 선수 기록 전체 ›
      </Link>


      {games.length > 0 && (
        <section className="player-section">
          <h3>일정·결과 <small className="muted">{games.length}경기</small></h3>
          <div className="team-games">
            {games.map((g) => {
              const opp = teamKey(g.opp.name);
              const done = g.game.status === "완료";
              return (
                <div key={g.game.game_idx} className="team-game">
                  <span className="team-game__date">{g.game.date.slice(5).replace("-", ".")}</span>
                  <span className="team-game__main">
                    <span className="team-game__title">{shortTitle(g.game.title)}{g.game.round ? ` · ${g.game.round}` : ""}</span>
                    <span>
                      vs <Link to={`/team/${encodeURIComponent(opp)}`}>{opp}</Link>{" "}
                      {done ? (
                        <a href={kbsaBoxScoreUrl(g.game.game_idx)} target="_blank" rel="noreferrer" className="team-game__score">
                          {g.me.score}:{g.opp.score}
                        </a>
                      ) : (
                        <span className="muted">{g.game.status} {g.game.time}</span>
                      )}
                    </span>
                  </span>
                  {g.outcome && <span className={`versus-game__result versus-game__result--${g.outcome}`}>{g.outcome}</span>}
                  <Link className="team-game__vs" to={`/versus?a=${encodeURIComponent(team)}&b=${encodeURIComponent(opp)}`}>대전 ›</Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
