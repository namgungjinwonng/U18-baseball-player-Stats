// 학교 정보 (데스크탑·모바일 공용) — /team: 지역별 학교 목록·검색, /team/:name: 시즌 성적·팀 타격/투구·주요 선수·일정, 대전 모드 입구.
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAllPlayers, useLeagueAverages, useSchedule, useStrength, useTeams, useYearRecords } from "./data";
import { emptyFilter, filterToQuery, unqualifiedToQuery, useQualifyContext } from "./filters";
import { dec2, rate } from "./format";
import { kbsaBoxScoreUrl } from "./kbsa";
import { Ico } from "./navIcons";
import { SearchIcon } from "./LineIcons";
import { PagedCardGrid } from "./PagedCardGrid";
import { buildTeamSummaries, MIN_TEAM_GRADE_GAMES, MIN_TEAM_GRADE_POPULATION, type TeamSummaryGrade } from "./teamSummary";
import { buildTeamDetailGrades } from "./teamDetailGrades";
import { sameTeam, teamGames, teamKey, teamRecord, teamTotals } from "./versus";
import { TopPlayersSection } from "./TopPlayers";
import { useYear } from "./year";

const shortTitle = (t: string) => (t || "").replace(/^\s*\d{4}\s*/, "").trim();

// 수치·리그 평균을 칸의 정중앙에 놓고 우측에 실제 등급을 표시한다.
function Cell({ k, v, avg, grade, fmt, wide = false }: {
  k: string;
  v: number | undefined;
  avg?: number;
  grade?: TeamSummaryGrade | null;
  fmt: (x: number) => string;
  wide?: boolean;
}) {
  return (
    <div className={`cell team-stat-cell grade-pastel${wide ? " team-stat-cell--wide" : ""}`} data-grade={grade?.grade}>
      <div className="k">{k}</div>
      <div className="team-cell__numbers">
        <div className="v">{v == null ? "-" : fmt(v)}</div>
        <div className="team-cell__avg">리그 {avg == null ? "—" : fmt(avg)}</div>
      </div>
      <span className="team-cell__grade"
        aria-label={grade ? `${k} 등급 ${grade.grade}, 백분위 ${grade.percentile}` : `${k} 등급 미산정`}
        title={grade ? `시즌 전체 학교 대비 백분위 ${grade.percentile}` : "완료 경기 수 또는 유효 비교 자료 부족"}
      >{grade?.grade ?? "-"}</span>
    </div>
  );
}

// 학교 시즌 성적도 선수 핵심 지표와 같은 등급·항목명·큰 수치 구성으로 표시한다.
function SeasonCard({ label, value, grade }: { label: string; value: string; grade?: TeamSummaryGrade | null }) {
  return (
    <div className="m-kpi__cell grade-pastel" data-grade={grade?.grade}
      title={grade ? `${label} 등급 ${grade.grade} · 백분위 ${grade.percentile}${label === "전적" ? " · 승률 기준" : ""}` : "등급 미산정"}>
      <span className="m-kpi__grade" aria-label={`${label} 등급 ${grade?.grade ?? "미산정"}`}>{grade?.grade ?? "-"}</span>
      <span className="m-kpi__k">{label}</span>
      <span className="m-kpi__v">{value}</span>
    </div>
  );
}

// 학교 정보 첫 화면 — 지역 선택 + 학교명 검색, 학교별 전적·팀타율·ERA·종합등급을
// 10개씩 가로 스와이프 페이지로 보인다. 카드를 누르면 학교 상세로 간다.
function TeamGradeBadge({ grade, label }: { grade: TeamSummaryGrade | null; label: string }) {
  return (
    <span
      className={`team-summary-card__grade${grade ? ` grade-bg--${grade.letter}` : ""}`}
      aria-label={grade ? `${label} 등급 ${grade.grade}, 백분위 ${grade.percentile}` : `${label} 등급 미산정`}
      title={grade ? `${label} · 시즌 전체 학교 대비 백분위 ${grade.percentile}` : "등급 미산정: 경기 수 또는 유효 비교 자료 부족"}
    >
      {grade?.grade ?? "-"}
    </span>
  );
}

export function TeamIndex({ wrapClass }: { wrapClass: string }) {
  const { year } = useYear();
  const nav = useNavigate();
  const teams = useTeams();
  const schedule = useSchedule();
  const records = useYearRecords(year);
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const games = useMemo(() => (schedule.data?.year === year ? schedule.data.games : []), [schedule.data, year]);
  const all = useMemo(
    () => buildTeamSummaries(
      year,
      teams.scope === String(year) ? teams.data ?? [] : [],
      games,
      records.scope === String(year) ? records.data ?? [] : []
    ),
    [year, teams.scope, teams.data, games, records.scope, records.data]
  );
  const regions = useMemo(
    () => [...new Set(all.map((t) => t.region).filter(Boolean))].sort((x, y) => x.localeCompare(y, "ko")),
    [all]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => (!region || t.region === region) && (!q || t.name.toLowerCase().includes(q)));
  }, [all, region, query]);
  const loading = teams.loading || schedule.loading || records.loading
    || teams.scope !== String(year) || records.scope !== String(year)
    || (!!schedule.data && schedule.data.year !== year);

  return (
    <div className={`${wrapClass} team-summary-index`}>
      <h2 className="heading-xl"><Ico name="team" variant="title" />학교 정보</h2>
      <p className="caption muted" style={{ margin: "-4px 0 12px" }}>학교를 누르면 {year} 시즌 성적·팀 타격/투구·주요 선수·일정을 볼 수 있습니다.</p>
      <div className="filter-bar">
        <div className="filter-bar__row">
          <select className="m-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="지역 선택">
            <option value="">지역 전체</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="search-pill" style={{ flex: 1, minWidth: 160 }}>
            <SearchIcon />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="학교명 검색" aria-label="학교명 검색" />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : (
        <>
          <p className="caption-sm" style={{ margin: "0 0 10px" }}>{filtered.length}개 학교</p>
          <p className="caption-sm team-summary-index__note" title={`완료 ${MIN_TEAM_GRADE_GAMES}경기 이상·세 지표가 모두 유효한 학교가 ${MIN_TEAM_GRADE_POPULATION}곳 이상일 때 계산합니다. 승률·팀타율·ERA(낮을수록 좋음)의 백분위를 동일 비중으로 평균한 뒤 종합점수를 다시 백분위로 환산합니다. 승률은 무승부를 제외합니다.`}>
            종합등급: {year} 시즌 전체 · 완료 {MIN_TEAM_GRADE_GAMES}경기 이상
            <br />승률·팀타율·ERA 동일 비중 · 표본·기록 부족은 -
          </p>
          {filtered.length > 0 ? (
            <PagedCardGrid perPage={10} compact>
              {filtered.map((t) => (
                <button key={t.name} type="button" className="sch-team-card team-summary-card" onClick={() => nav(`/team/${encodeURIComponent(t.name)}`)}>
                  <div className="sch-team-card__head">
                    <h3 title={t.name}>{t.name}</h3>
                    {t.region && <span className="sch-team-card__reg">{t.region}</span>}
                  </div>
                  <div className="team-summary-card__summary">
                    <div className="team-summary-card__record">
                      <span className="team-summary-card__results">
                        <span className="team-summary-card__wins">{t.rec.w}승</span>
                        <span className="team-summary-card__losses">{t.rec.l}패</span>
                        {t.rec.d > 0 && <span className="team-summary-card__draws">{t.rec.d}무</span>}
                      </span>
                      <span className="team-summary-card__pct" aria-label={`승률 ${t.pct == null ? "미산정" : t.pct.toFixed(3)}`}>({t.pct == null ? "-" : t.pct.toFixed(3)})</span>
                    </div>
                    <div className="team-summary-card__metrics">
                      <div className="team-summary-card__metric">
                        <span className="team-summary-card__label">팀타율</span>
                        <b>{rate(t.avg ?? undefined)}</b>
                      </div>
                      <div className="team-summary-card__metric">
                        <span className="team-summary-card__label">ERA</span>
                        <b>{dec2(t.era ?? undefined)}</b>
                      </div>
                    </div>
                    <TeamGradeBadge grade={t.overallGrade} label="종합" />
                  </div>
                </button>
              ))}
            </PagedCardGrid>
          ) : (
            <div className="state">검색 결과가 없습니다.</div>
          )}
        </>
      )}
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
  const seasonRecords = useMemo(() => records.data?.filter((p) => p.season === year) ?? [], [records.data, year]);
  const totals = useMemo(() => teamTotals(seasonRecords, team), [seasonRecords, team]);
  const detail = useMemo(() => buildTeamDetailGrades(
    year,
    teams.scope === String(year) ? teams.data ?? [] : [],
    schedule.data?.year === year ? schedule.data.games : [],
    seasonRecords,
    strength.data
  ).find((row) => row.name === team), [year, teams.scope, teams.data, schedule.data, seasonRecords, strength.data, team]);
  const grades = detail?.grades;
  const topTeams = useMemo(() => [team], [team]);
  const str = useMemo(
    () => Object.entries(strength.data?.season === year ? strength.data.teams : {}).find(([t]) => sameTeam(t, team))?.[1],
    [strength.data, team, year]
  );
  // 상대 학교 선택지 — 이번 시즌 상대한 학교를 경기 수 순으로.
  const opponents = useMemo(() => {
    const count = new Map<string, number>();
    for (const g of games) count.set(teamKey(g.opp.name), (count.get(teamKey(g.opp.name)) ?? 0) + 1);
    return [...count.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "ko"));
  }, [games]);

  const lg = averages.data?.season === year ? averages.data.overall : undefined;
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
        {roster && <span>선수 {roster.players.filter((p) => !p.moved_to).length}명</span>}
        {/* 줄의 "·" 구분자는 span 앞에만 붙으므로 링크도 span으로 감싼다 */}
        {roster && <span><Link to={`/players?team=${encodeURIComponent(roster.team)}`}>선수현황 ›</Link></span>}
        <span><Link to="/team">다른 학교 보기 ›</Link></span>
      </div>

      <div className="team-versus">
        <label className="caption" htmlFor="team-versus-select">상대 학교 선택 → 매치업</label>
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
          <div className="m-kpi m-kpi--player-grade team-season-kpi">
            <SeasonCard label="전적" value={`${rec.w}-${rec.l}${rec.d ? `-${rec.d}` : ""}`} grade={grades?.winPct} />
            <SeasonCard label="승률" value={pct} grade={grades?.winPct} />
            <SeasonCard label="득점" value={String(rec.rf)} grade={grades?.runsFor} />
            <SeasonCard label="실점" value={String(rec.ra)} grade={grades?.runsAgainst} />
          </div>
        </section>
      )}

      {totals && (
        <>
          <section className="player-section">
            <h3>팀 타격</h3>
            <div className="m-strip team-strip">
              <Cell k="타율" v={detail?.values.avg ?? undefined} avg={lg?.avg} grade={grades?.avg} fmt={rate} />
              <Cell k="출루율" v={detail?.values.obp ?? undefined} avg={lg?.obp} grade={grades?.obp} fmt={rate} />
              <Cell k="장타율" v={detail?.values.slg ?? undefined} avg={lg?.slg} grade={grades?.slg} fmt={rate} />
              <Cell k="OPS" v={detail?.values.ops ?? undefined} avg={lg?.ops} grade={grades?.ops} fmt={rate} />
              <Cell k="홈런" v={detail?.values.hr ?? undefined} grade={grades?.hr} fmt={String} />
              <Cell k="도루" v={detail?.values.sb ?? undefined} grade={grades?.sb} fmt={String} />
              {str && <Cell k="타선 강도지수" v={str.bat} avg={1} grade={grades?.batStrength} fmt={dec2} wide />}
            </div>
          </section>
          <section className="player-section">
            <h3>팀 투구</h3>
            <div className="m-strip team-strip">
              <Cell k="ERA" v={detail?.values.era ?? undefined} avg={lg?.era} grade={grades?.era} fmt={dec2} />
              <Cell k="WHIP" v={detail?.values.whip ?? undefined} avg={lg?.whip} grade={grades?.whip} fmt={dec2} />
              <Cell k="K/9" v={detail?.values.k9 ?? undefined} avg={lg?.k9} grade={grades?.k9} fmt={(x) => x.toFixed(1)} />
              <Cell k="BB/9" v={detail?.values.bb9 ?? undefined} avg={lg?.bb9} grade={grades?.bb9} fmt={(x) => x.toFixed(1)} />
              {str && <Cell k="마운드 강도지수" v={str.pit} avg={1} grade={grades?.pitStrength} fmt={dec2} wide />}
            </div>
            <p className="caption muted">팀 비율은 선수 기록 합산 원자료로 재계산 · 등급은 {year} 시즌 전체 학교 대비 · 완료 {MIN_TEAM_GRADE_GAMES}경기 이상, 항목별 유효 학교 {MIN_TEAM_GRADE_POPULATION}곳 이상 · A+~E- 파스텔 15단계 · 자료 부족은 -</p>
          </section>
        </>
      )}

      <TopPlayersSection teams={topTeams} records={records.data} ctx={ctx} title="주요 선수" />
      {/* "전체" = 규정 미달 선수까지 — 학교별 랭킹 링크와 같이 u=1 로 규정 미달 포함을 켠 채 연다 */}
      <Link className="link-btn" to={`/records${unqualifiedToQuery(filterToQuery({ ...emptyFilter, team: roster?.team ?? team }))}`}>
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
