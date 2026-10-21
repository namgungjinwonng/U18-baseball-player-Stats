// 학교 A vs 학교 B 대전 모드 화면 (데스크탑·모바일 공용) — /versus?a=학교&b=학교&v=탭&g=경기
import { useMemo, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useAllPlayers, useLeagueAverages, usePlayerIndexes, useSeasonPlayerFiles, usePlayerFiles, usePlayerIndex, useSchedule, useSchedules, useStrength, useTeams,
  useTournamentMatchups, useTournamentRecords, useTournaments,
} from "./data";
import { useQualifyContext } from "./filters";
import { dec2, rate } from "./format";
import { kbsaBoxScoreUrl } from "./kbsa";
import { MirrorBars, type MirrorRow } from "./MirrorBars";
import { analyzeVersus, type MetricKey } from "./versusAnalysis";
import { Ico } from "./navIcons";
import { indexById } from "./matchup";
import { useDevice } from "./useDevice";
import {
  cellKey, commonOpponents, headToHead, mergeMatrices, sameTeam, teamExtra, teamGames, teamKey, teamRecord, teamTotals, versusMatrix,
  type MatrixSide, type Record3, type SideGame,
} from "./versus";
import { TopPlayersSection } from "./TopPlayers";
import { useYear } from "./year";
import { Chip } from "../design/ui";
import type { ScheduleGame } from "./types";

type Tab = "sum" | "stat" | "player" | "game";
const TABS: { id: Tab; label: string }[] = [
  { id: "sum", label: "요약" },
  { id: "stat", label: "팀지표" },
  { id: "player", label: "선수" },
  { id: "game", label: "경기" },
];

const shortTitle = (t: string) => (t || "").replace(/^\s*\d{4}\s*/, "").trim();
const recordText = (r: Record3) => `${r.w}승 ${r.l}패${r.d ? ` ${r.d}무` : ""}`;
const winPct = (r: Record3) => (r.w + r.l ? r.w / (r.w + r.l) : null);

// 학교 선택 — 지역별로 묶은 드롭다운.
function TeamSelect({
  value, onChange, options, label,
}: {
  value: string;
  onChange: (team: string) => void;
  options: { region: string; teams: string[] }[];
  label: string;
}) {
  return (
    <select className="m-select versus-bar__team" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((group) => (
        <optgroup key={group.region || "기타"} label={group.region || "기타"}>
          {group.teams.map((team) => (
            <option key={team} value={team}>{team}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function GameRow({ g, aName, bName, focus }: { g: SideGame; aName: string; bName: string; focus?: boolean }) {
  const done = g.game.status === "완료";
  return (
    <a className={`versus-game ${focus ? "is-focus" : ""}`} href={kbsaBoxScoreUrl(g.game.game_idx)} target="_blank" rel="noreferrer">
      <span className="versus-game__date">{g.game.date.slice(2).replace(/-/g, ".")}</span>
      <span className="versus-game__title">
        {shortTitle(g.game.title)}
        {g.game.round && <small> · {g.game.round}</small>}
      </span>
      <span className="versus-game__score">
        {done ? (
          <>
            <span className={g.outcome === "승" ? "is-win" : ""}>{aName} {g.me.score ?? "-"}</span>
            {" : "}
            <span className={g.outcome === "패" ? "is-win" : ""}>{g.opp.score ?? "-"} {bName}</span>
          </>
        ) : (
          <span className="muted">{g.game.status || "예정"} {g.game.time}</span>
        )}
      </span>
      {g.outcome && <span className={`versus-game__result versus-game__result--${g.outcome}`}>{g.outcome}</span>}
      {/* 행 전체가 KBSA 박스스코어 링크임을 보이게 한다 */}
      <span className="versus-game__kbsa">KBSA ↗</span>
    </a>
  );
}

// 기기 로컬 날짜(YYYY-MM-DD) — toISOString()은 UTC라 KST 새벽에 하루 전이 된다.
const localYmd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// 경기일정에서 경기 카드를 눌러 들어온 경우 그 경기 요약과 KBSA 공식 기록 바로가기.
function FocusGame({ game }: { game: ScheduleGame }) {
  const done = game.status === "완료";
  const when = game.date === localYmd() ? "오늘 경기" : "이 경기";
  return (
    <div className="versus-focus">
      <div className="versus-focus__info">
        <span className="caption muted">
          {game.date.slice(2).replace(/-/g, ".")} · {shortTitle(game.title)}{game.round ? ` · ${game.round}` : ""}
        </span>
        <b>
          {done
            ? `${teamKey(game.away.name)} ${game.away.score ?? "-"} : ${game.home.score ?? "-"} ${teamKey(game.home.name)}`
            : `${teamKey(game.away.name)} vs ${teamKey(game.home.name)} · ${game.status || "예정"} ${game.time}`}
        </b>
      </div>
      <a className="btn btn--primary btn--sm versus-focus__kbsa" href={kbsaBoxScoreUrl(game.game_idx)} target="_blank" rel="noreferrer">
        {done ? `${when} 공식 기록 KBSA 가기 ↗` : `${when} KBSA 경기 정보 ↗`}
      </a>
    </div>
  );
}

export function VersusView({ wrapClass }: { wrapClass: string }) {
  const compact = useDevice() === "mobile";
  const [params, setParams] = useSearchParams();
  const a = params.get("a") ?? "";
  const b = params.get("b") ?? "";
  // 고교 팀끼리는 한 해에 많아야 몇 번 만나므로 맞대결 전적은 항상 통산으로 보고, 대회 필터는 두지 않는다(사용자 요청).
  // 선수 맞대결표는 선택 시즌 기본 + 연도·통산 선택(py). 팀 지표·주요 선수·공통 상대는 선택 시즌 전체 기준.
  const slug = "";
  const all = true;
  const tab = (TABS.find((t) => t.id === params.get("v"))?.id ?? "sum") as Tab;
  const side = (params.get("m") === "bBat" ? "bBat" : "aBat") as MatrixSide;
  const focusId = params.get("g") ?? ""; // 경기일정 카드에서 넘어온 경기 game_idx
  // 선택 상태는 모두 URL에 둔다 — 새로고침·뒤로가기·링크 공유 시 그대로 복원된다.
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const { year, years, setYear } = useYear();
  const teams = useTeams();
  const schedule = useSchedule();
  const tournaments = useTournaments();
  const records = useTournamentRecords(slug);
  const seasonRecords = useAllPlayers();
  const strength = useStrength();
  const averages = useLeagueAverages();
  const indexState = usePlayerIndex();
  const allSchedules = useSchedules(all ? years : []);
  const ctx = useQualifyContext({ region: "", team: "", grade: "", tournament: slug });
  const tournamentMatchups = useTournamentMatchups(slug);

  const tournamentTitle = tournaments.data?.find((t) => t.slug === slug)?.title;
  const seasonGames: ScheduleGame[] = schedule.data?.year === year ? schedule.data.games : [];
  const games = all ? allSchedules.data ?? [] : seasonGames;
  const scopeTitle = all ? undefined : tournamentTitle;
  const ready = !!a && !!b && !sameTeam(a, b);
  const focusGame = useMemo(
    () => (focusId ? [...seasonGames, ...(allSchedules.data ?? [])].find((g) => g.game_idx === focusId) ?? null : null),
    [focusId, seasonGames, allSchedules.data]
  );

  // 학교 목록: 선수현황(teams.json) 정식명 + 일정에만 있는 학교. 지역별 그룹.
  const teamOptions = useMemo(() => {
    const region = new Map<string, string>();
    for (const t of teams.data ?? []) region.set(teamKey(t.team), t.region);
    for (const g of seasonGames) {
      for (const s of [g.away, g.home]) if (!region.has(teamKey(s.name))) region.set(teamKey(s.name), "");
    }
    const groups = new Map<string, string[]>();
    for (const [team, r] of region) groups.set(r, [...(groups.get(r) ?? []), team]);
    return [...groups.entries()]
      .map(([r, list]) => ({ region: r, teams: list.sort((x, y) => x.localeCompare(y, "ko")) }))
      .sort((x, y) => (x.region ? x.region.localeCompare(y.region || "힣", "ko") : 1));
  }, [teams.data, seasonGames]);


  const h2h = useMemo(() => (ready ? headToHead(games, a, b, scopeTitle) : null), [ready, games, a, b, scopeTitle]);
  const common = useMemo(() => (ready ? commonOpponents(seasonGames, a, b) : []), [ready, seasonGames, a, b]);
  const recA = useMemo(() => (ready ? teamRecord(seasonGames, a, tournamentTitle) : null), [ready, seasonGames, a, tournamentTitle]);
  const recB = useMemo(() => (ready ? teamRecord(seasonGames, b, tournamentTitle) : null), [ready, seasonGames, b, tournamentTitle]);
  const totA = useMemo(() => (ready && records.data ? teamTotals(records.data, a) : null), [ready, records.data, a]);
  const totB = useMemo(() => (ready && records.data ? teamTotals(records.data, b) : null), [ready, records.data, b]);
  const strengthOf = useMemo(() => {
    const m = new Map<string, { bat: number; pit: number }>();
    for (const [team, s] of Object.entries(strength.data?.teams ?? {})) m.set(teamKey(team), s);
    return m;
  }, [strength.data]);

  // 선수 맞대결표 — 대회 선택 시 대회 matchups.json, 시즌이면 선수 수가 적은 학교의 선수 파일만 받는다.
  const showPlayers = ready && !all && (!compact || tab === "player");
  const fileIds = useMemo(() => {
    if (!showPlayers || slug || !seasonRecords.data) return [];
    const of = (team: string) => seasonRecords.data!.filter((p) => sameTeam(p.team, team)).map((p) => p.id);
    const ia = of(a);
    const ib = of(b);
    return ia.length <= ib.length ? ia : ib;
  }, [showPlayers, slug, seasonRecords.data, a, b]);
  const files = usePlayerFiles(fileIds);
  const byId = useMemo(() => indexById(indexState.data ?? []), [indexState.data]);
  const matrix = useMemo(() => {
    if (!showPlayers) return null;
    const list = slug
      ? tournamentMatchups.data ?? []
      : files.scope === `${year}:${fileIds.join(",")}` ? (files.data ?? []).flatMap((f) => f.matchups ?? []) : null;
    return list ? versusMatrix(list, byId, a, b, side) : null;
  }, [showPlayers, slug, tournamentMatchups.data, files.scope, files.data, year, fileIds, byId, a, b, side]);

  // 통산 맞대결 — 두 학교가 실제로 맞붙은 시즌만 골라 시즌별 표를 만든 뒤 합친다.
  // 시즌마다 선수 수가 적은 학교의 선수 파일만 받는다(선수 파일에 타자·투수 양방향 기록이 있다).
  const showAllPlayers = ready && all && (!compact || tab === "player");
  const h2hYears = useMemo(
    () =>
      showAllPlayers && h2h
        ? [...new Set(h2h.games.filter((g) => g.outcome != null).map((g) => Number(g.game.date.slice(0, 4))))].sort((x, y) => x - y)
        : [],
    [showAllPlayers, h2h]
  );
  const yearIndexes = usePlayerIndexes(h2hYears);
  const fileSpecs = useMemo(() => {
    if (!h2hYears.length || yearIndexes.scope !== h2hYears.join(",") || !yearIndexes.data) return [];
    return h2hYears.map((y) => {
      const idx = yearIndexes.data![y] ?? [];
      const of = (team: string) => idx.filter((p) => sameTeam(p.team, team)).map((p) => p.id);
      const ia = of(a);
      const ib = of(b);
      return { year: y, ids: ia.length <= ib.length ? ia : ib };
    });
  }, [h2hYears, yearIndexes.scope, yearIndexes.data, a, b]);
  const yearFiles = useSeasonPlayerFiles(fileSpecs);
  const specKey = fileSpecs.map((f) => `${f.year}:${f.ids.join(",")}`).join("|");
  const yearMatrices = useMemo(() => {
    if (!showAllPlayers || !h2h) return null;
    if (h2hYears.length === 0) return [];
    if (!specKey || yearFiles.scope !== specKey || !yearFiles.data || !yearIndexes.data) return null;
    return h2hYears.map((y) => ({
      year: y,
      matrix: versusMatrix(
        (yearFiles.data![y] ?? []).flatMap((f) => f.matchups ?? []),
        indexById(yearIndexes.data![y] ?? []),
        a, b, side
      ),
    }));
  }, [showAllPlayers, h2h, h2hYears, specKey, yearFiles.scope, yearFiles.data, yearIndexes.data, a, b, side]);
  // 표 기준 연도 — 기본은 선택 시즌, 맞붙은 다른 시즌이나 통산(py=all)으로 바꿀 수 있다.
  // 졸업 선수도 그 시즌 기록으로 보이도록 시즌별 표를 기본으로 한다.
  const matrixYears = useMemo(() => [...new Set([year, ...h2hYears])].sort((x, y) => y - x), [year, h2hYears]);
  const pyParam = params.get("py");
  const matrixYear: number | "all" = pyParam === "all" ? "all" : matrixYears.includes(Number(pyParam)) ? Number(pyParam) : year;
  const allMatrix = useMemo(
    () => (!yearMatrices ? null : matrixYear === "all" ? mergeMatrices(yearMatrices) : null),
    [yearMatrices, matrixYear]
  );
  const yearMatrix = useMemo(
    () => (!yearMatrices || matrixYear === "all" ? null : yearMatrices.find((m) => m.year === matrixYear)?.matrix ?? mergeMatrices([])),
    [yearMatrices, matrixYear]
  );
  const shownMatrix = all ? allMatrix ?? yearMatrix : matrix;
  const loadingFiles = all ? fileSpecs.reduce((n, f) => n + f.ids.length, 0) : fileIds.length;
  // 선수 ID는 시즌마다 달라 그 시즌으로 전환한 뒤 그 시즌 선수 화면으로 연결한다.
  // 통산 표는 대표(가장 최근) 시즌 기록으로 연결한다.
  const linkYearOf = (p: { id: string }) =>
    matrixYear === "all" ? allMatrix?.yearOf.get(p.id) ?? year : matrixYear;
  const playerLink = (p: { id: string; name: string }) => {
    const y = linkYearOf(p);
    return <Link to={`/player/${encodeURIComponent(p.id)}`} onClick={() => y !== year && setYear(y)}>{p.name}</Link>;
  };

  const aName = teamKey(a);
  const bName = teamKey(b);
  const loading = schedule.loading || teams.loading || (all && allSchedules.loading);

  const statRows: MirrorRow[] = [
    { key: "pct", label: "승률", a: recA && winPct(recA), b: recB && winPct(recB), format: (v) => v.toFixed(3) },
    { key: "avg", label: "팀 타율", a: totA?.batting.avg, b: totB?.batting.avg, format: rate },
    { key: "obp", label: "출루율", a: totA?.batting.obp, b: totB?.batting.obp, format: rate },
    { key: "ops", label: "OPS", a: totA?.batting.ops, b: totB?.batting.ops, format: rate },
    { key: "hr", label: "홈런", a: totA?.batting.hr, b: totB?.batting.hr, format: String },
    { key: "sb", label: "도루", a: totA?.batting.sb, b: totB?.batting.sb, format: String },
    { key: "era", label: "팀 ERA", a: totA?.pitching.era, b: totB?.pitching.era, format: dec2, lowerIsBetter: true },
    { key: "whip", label: "WHIP", a: totA?.pitching.whip, b: totB?.pitching.whip, format: dec2, lowerIsBetter: true },
    { key: "k9", label: "K/9", a: totA?.pitching.k9, b: totB?.pitching.k9, format: (v) => v.toFixed(1) },
    { key: "bb9", label: "BB/9", a: totA?.pitching.bb9, b: totB?.pitching.bb9, format: (v) => v.toFixed(1), lowerIsBetter: true },
    { key: "sbat", label: "타선 강도지수", a: strengthOf.get(aName)?.bat, b: strengthOf.get(bName)?.bat, format: dec2 },
    { key: "spit", label: "마운드 강도지수", a: strengthOf.get(aName)?.pit, b: strengthOf.get(bName)?.pit, format: dec2 },
  ];

  const headline = h2h && (
    <section className="versus-section">
      <h3 className="heading-md">맞대결{all ? ` · 통산 ${Math.min(...years)}–${Math.max(...years)}` : ""}</h3>
      {h2h.w + h2h.l + h2h.d === 0 ? (
        <p className="state muted">{all ? "기록된 맞대결이 없습니다." : `${year} 시즌${tournamentTitle ? " 이 대회" : ""}에는 맞대결이 없습니다.`}</p>
      ) : (
        <p className="versus-headline">
          <b>{aName}</b> {recordText(h2h)} <span className="muted">· 득실 {h2h.rf}:{h2h.ra}</span>
        </p>
      )}
    </section>
  );

  const gameList = (limit?: number) =>
    h2h && h2h.games.length > 0 && (
      <div className="versus-games">
        {(limit ? h2h.games.slice(0, limit) : h2h.games).map((g) => (
          <GameRow key={g.game.game_idx} g={g} aName={aName} bName={bName} focus={g.game.game_idx === focusId} />
        ))}
        {limit && h2h.games.length > limit && (
          <button type="button" className="link-btn" onClick={() => update({ v: "game" })}>
            맞대결 {h2h.games.length}경기 모두 보기 ›
          </button>
        )}
      </div>
    );

  // 기록 조건에 맞는 경기 분석 문구 (규칙 101개 중 분류당 한 줄, 최대 6줄)
  // 경기 분석용: 선택 시즌의 완료 경기(최근 흐름·접전 성적)
  const seasonDone = (team: string) =>
    teamGames(seasonGames, team)
      .filter((g) => g.outcome && g.me.score != null && g.opp.score != null)
      .map((g) => ({ date: g.game.date, rf: g.me.score!, ra: g.opp.score!, outcome: g.outcome! }));
  // 한쪽이라도 이 범위(시즌·대회)의 기록이 없으면 지표 비교·분석이 의미가 없어 안내만 보인다.
  const missing = ready && !records.loading && records.data ? [totA ? null : aName, totB ? null : bName].filter(Boolean) as string[] : [];
  const analysis = ready && !records.loading && missing.length === 0
    ? analyzeVersus({
        aName,
        bName,
        metrics: Object.fromEntries(statRows.map((r) => [r.key, { a: r.a, b: r.b }])) as Partial<Record<MetricKey, { a?: number | null; b?: number | null }>>,
        recA,
        recB,
        h2h: h2h && {
          ...h2h,
          games: h2h.games.map((g) => ({
            date: g.game.date, status: g.game.status, me: g.me.score, opp: g.opp.score, outcome: g.outcome, title: g.game.title,
          })),
        },
        extra: { a: teamExtra(totA), b: teamExtra(totB) },
        year,
        seasonA: seasonDone(a),
        seasonB: seasonDone(b),
        allYears: all,
        lg: tournamentTitle ? averages.data?.tournaments[slug]?.rates ?? averages.data?.overall : averages.data?.overall,
      })
    : [];

  const statSection = (
    <section className="versus-section">
      <h3 className="heading-md">팀 지표 비교</h3>
      <p className="caption muted">{tournamentTitle ? shortTitle(tournamentTitle) : `${year} 시즌 전체`} 기준 · 비율은 합산 원자료로 재계산 · 강도지수 1.00 = 리그 평균</p>
      {missing.length > 0 && (
        <p className="state muted">
          {missing.join("·")}의 {tournamentTitle ? "이 대회" : `${year} 시즌`} 기록이 없어 지표를 비교할 수 없습니다.
        </p>
      )}
      {analysis.length > 0 && (
        <div className="versus-analysis">
          <h4>경기 분석 <small>기록 기반 자동 분석 · 참고용</small></h4>
          <ul>
            {analysis.map((line) => (
              <li key={line.id} className={line.cat === "overall" ? "is-head" : line.cat === "sample" ? "is-note" : undefined}>
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {records.loading ? <div className="state">불러오는 중…</div> : missing.length === 0 && <MirrorBars rows={statRows} aName={aName} bName={bName} />}
    </section>
  );

  const topTeams = useMemo(() => [aName, bName], [aName, bName]);
  const topSection = (
    <TopPlayersSection teams={topTeams} records={records.data} ctx={ctx} title="팀별 주요 선수" allowPrev />
  );

  const [batTeam, pitTeam] = side === "aBat" ? [aName, bName] : [bName, aName];
  const playerSection = (
    <section className="versus-section">
      <h3 className="heading-md">선수 맞대결표</h3>
      <>
          <div className="m-tabs versus-side">
            <Chip active={side === "aBat"} onClick={() => update({ m: "" })}>{aName} 타자 vs {bName} 투수</Chip>
            <Chip active={side === "bBat"} onClick={() => update({ m: "bBat" })}>{bName} 타자 vs {aName} 투수</Chip>
          </div>
          <div className="career-mode-toggle versus-year" role="group" aria-label="선수 맞대결표 기준 연도">
            {matrixYears.map((y) => (
              <button key={y} type="button" className={matrixYear === y ? "active" : ""} onClick={() => update({ py: y === year ? "" : String(y) })}>
                {y}
              </button>
            ))}
            {h2hYears.length > 1 && (
              <button type="button" className={matrixYear === "all" ? "active" : ""} onClick={() => update({ py: "all" })}>통산</button>
            )}
          </div>
          <p className="caption muted">
            {matrixYear === "all"
              ? `통산 ${h2hYears.join("·")} 맞대결 시즌 합산 · 이름·학년은 가장 최근 시즌 기준 · `
              : `${matrixYear} 시즌 기준 · 이름을 누르면 ${matrixYear} 시즌 기록으로 이동 · `}
            칸 = 안타/타수 · 작은 글씨 = 타석 · 안타가 있으면 진하게, 무안타는 흐리게
          </p>
          {!shownMatrix ? (
            <div className="state">{loadingFiles ? `${loadingFiles}명 기록을 불러오는 중…` : "불러오는 중…"}</div>
          ) : shownMatrix.batters.length === 0 ? (
            <div className="state muted">
              {matrixYear === "all"
                ? "두 학교가 맞붙은 시즌에 선수 맞대결 기록이 없습니다."
                : `${matrixYear} 시즌에는 두 학교 선수의 맞대결 기록이 없습니다.${h2hYears.some((y) => y !== matrixYear) ? " 위에서 다른 연도를 선택해 보세요." : ""}`}
            </div>
          ) : (
            <div className="versus-matrix">
              <table>
                <thead>
                  <tr>
                    {/* 대각선으로 나눈 모서리 — 오른쪽 위 = 열(투수), 왼쪽 아래 = 행(타자). 타자 이름 열이 넓어지지 않게 두 줄로 쓴다 */}
                    <th
                      className="versus-matrix__corner"
                      aria-label={`${batTeam} 타자, ${pitTeam} 투수`}
                      // 학교명이 길면 칸이 넓어지므로 반대쪽 여백도 비례해 늘려 글자가 대각선에 걸치지 않게 한다
                      style={{ "--corner-pad": `${Math.max(batTeam.length, pitTeam.length) * 5 + 15}px` } as CSSProperties}
                    >
                      <span className="versus-matrix__corner-pit">{pitTeam} 투수</span>
                      <span className="versus-matrix__corner-bat">{batTeam} 타자</span>
                    </th>
                    {shownMatrix.pitchers.map((p) => (
                      <th key={p.id}>{playerLink(p)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shownMatrix.batters.map((bt) => (
                    <tr key={bt.id}>
                      <th>{playerLink(bt)}</th>
                      {shownMatrix.pitchers.map((pt) => {
                        const m = shownMatrix.cells.get(cellKey(bt.id, pt.id));
                        return (
                          <td key={pt.id} className={m ? (m.h > 0 ? "is-hit" : "is-no-hit") : ""}>
                            {m ? (
                              <>
                                <b>{m.h}/{m.ab}</b>
                                <small>{m.pa}타석</small>
                              </>
                            ) : (
                              <span className="muted">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </>
    </section>
  );

  const commonSection = (
    <section className="versus-section">
      <h3 className="heading-md">공통 상대 성적</h3>
      {common.length === 0 ? (
        <p className="state muted">두 학교가 모두 상대한 학교가 없습니다.</p>
      ) : (
        <div className="stat-table__scroll">
          <table className="stat-table versus-common">
            <thead>
              <tr>
                <th>상대</th>
                <th>{aName}</th>
                <th>{bName}</th>
              </tr>
            </thead>
            <tbody>
              {common.map((row) => {
                const pa = winPct(row.a) ?? 0;
                const pb = winPct(row.b) ?? 0;
                return (
                  <tr key={row.opponent}>
                    <td><Link to={`/team/${encodeURIComponent(row.opponent)}`}>{row.opponent}</Link></td>
                    <td className={pa > pb ? "is-better" : ""}>{recordText(row.a)} <small>{row.a.rf}:{row.a.ra}</small></td>
                    <td className={pb > pa ? "is-better" : ""}>{recordText(row.b)} <small>{row.b.rf}:{row.b.ra}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className={`${wrapClass} versus-page`}>
      <h2 className="heading-xl"><Ico name="versus" variant="title" />매치업</h2>
      <p className="caption muted versus-page__description">상대전적부터 팀 전력 비교까지</p>
      <div className={`versus-bar ${compact ? "versus-bar--compact" : ""}`}>
        <div className="versus-bar__teams">
          <TeamSelect value={aName} onChange={(team) => update({ a: team, t: "", g: "" })} options={teamOptions} label="학교 A" />
          <button
            type="button"
            className="icon-btn versus-bar__swap"
            aria-label="좌우 바꾸기"
            disabled={!a && !b}
            onClick={() => update({ a: b, b: a })}
          >
            ⇄
          </button>
          <TeamSelect value={bName} onChange={(team) => update({ b: team, t: "", g: "" })} options={teamOptions} label="학교 B" />
        </div>
      </div>
      {/* 상단에는 학교 선택만 고정하고, 대회·통산·탭은 본문과 함께 스크롤한다 */}
      <div className="versus-controls">
        {ready && focusGame && <FocusGame game={focusGame} />}
        {ready && compact && (
          <div className="m-tabs versus-tabs" role="tablist">
            {TABS.map((t) => (
              <Chip key={t.id} active={tab === t.id} onClick={() => update({ v: t.id === "sum" ? "" : t.id })}>{t.label}</Chip>
            ))}
          </div>
        )}
      </div>

      {!ready && (
        <p className="state muted">
          {a && b ? "서로 다른 두 학교를 고르세요." : "비교할 두 학교를 고르세요. 경기일정·팀 상세·학교별 랭킹에서도 바로 들어올 수 있습니다."}
        </p>
      )}
      {ready && loading && <div className="state">불러오는 중…</div>}
      {ready && !loading && compact && (
        <>
          {tab === "sum" && (
            <>
              {headline}
              {gameList(3)}
              {topSection}
            </>
          )}
          {tab === "stat" && statSection}
          {tab === "player" && playerSection}
          {tab === "game" && (
            <>
              {headline}
              {gameList()}
              {commonSection}
            </>
          )}
        </>
      )}
      {ready && !loading && !compact && (
        <>
          {headline}
          {gameList()}
          {statSection}
          {topSection}
          {playerSection}
          {commonSection}
        </>
      )}
    </div>
  );
}
