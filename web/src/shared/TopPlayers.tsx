// 학교 대전·팀 상세의 "주요 선수" 영역 — 올해 시즌 / 전년도 기준(재학생) 전환 (데스크탑·모바일 공용).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeams, useYearMeta, useYearRecords } from "./data";
import { dec2, rate } from "./format";
import { seasonConfig, type QualifyContext } from "./leaders";
import { playerHref, returningTopPlayers, sameTeam, teamKey, topPlayers, type TopPlayers } from "./versus";
import { useYear } from "./year";
import type { Player } from "./types";

export function TopList({ title, players, value, emptyText = "규정 충족 선수 없음", hrefOf, sample }: {
  title: string;
  players: Player[];
  value: (p: Player) => string;
  sample?: (p: Player) => string; // 규정 미달 포함 시 표본(타석·이닝)
  emptyText?: string;
  hrefOf?: (p: Player) => string; // 다른 시즌 선수 링크 (기본은 /player/ID)
}) {
  return (
    <div className="versus-top__col">
      <h4>{title}</h4>
      {players.length === 0 && <p className="caption muted">{emptyText}</p>}
      <ol>
        {players.map((p) => (
          <li key={p.id}>
            <Link to={hrefOf ? hrefOf(p) : `/player/${p.id}`}>{p.name}</Link>
            {p.grade && <small> {p.grade}학년</small>}
            <span className="versus-top__v">{value(p)}{sample && <small className="versus-top__sample">{sample(p)}</small>}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const opsText = (p: Player) => rate((p.batting?.obp ?? 0) + (p.batting?.slg ?? 0));
const eraText = (p: Player) => dec2(p.pitching?.era);
const isEmpty = (tp: TopPlayers) => tp.batters.length === 0 && tp.pitchers.length === 0;

export function TopPlayersSection({
  teams, records, ctx, title, allowPrev = true,
}: {
  teams: string[];
  records: Player[] | null; // 올해(또는 선택 대회) 기록
  ctx: QualifyContext; // 올해 규정 컨텍스트
  title: string;
  allowPrev?: boolean; // 대회·통산 보기처럼 전년도 기준이 어울리지 않으면 false
}) {
  const { year, years } = useYear();
  const prevYear = allowPrev && years.includes(year - 1) ? year - 1 : null;
  const roster = useTeams(); // 올해 선수현황 — 졸업생 판별용
  const prevRecords = useYearRecords(prevYear);
  const prevMeta = useYearMeta(prevYear);
  const [choice, setChoice] = useState<"auto" | "current" | "prev">("auto");
  const [unq, setUnq] = useState<"auto" | boolean>("auto"); // 규정 미달 포함

  const strict = useMemo(
    () => (records ? teams.map((team) => topPlayers(records, team, ctx)) : null),
    [records, teams, ctx]
  );
  const relaxed = useMemo(
    () => (records ? teams.map((team) => topPlayers(records, team, ctx, 3, true)) : null),
    [records, teams, ctx]
  );
  // 기본(auto): 한쪽이라도 규정 충족 선수가 없으면 규정 미달 포함으로 보여 준다(표본 있는 선수가 있을 때).
  const strictLacking = !!strict && strict.some(isEmpty);
  const relaxedHas = !!relaxed && relaxed.some((tp) => !isEmpty(tp));
  const includeUnq = unq === "auto" ? strictLacking && relaxedHas : unq;
  const current = includeUnq ? relaxed : strict;
  const prev = useMemo(() => {
    if (!prevYear || !prevRecords.data) return null;
    const prevCtx: QualifyContext = {
      scope: "season",
      config: seasonConfig(prevYear),
      teamGames: prevMeta.data?.teamGames ?? {},
    };
    return teams.map((team) => {
      const entry = roster.data?.find((r) => sameTeam(r.team, team));
      const pairs = (entry?.players ?? []).filter((p) => p.person_no).map((p) => [p.person_no, p.grade] as [string, string]);
      return returningTopPlayers(prevRecords.data!, team, pairs.length ? new Map(pairs) : null, prevCtx);
    });
  }, [prevYear, prevRecords.data, prevMeta.data, roster.data, teams]);

  // 기본(auto): 올해 규정 충족 선수가 없는 학교가 있으면 전년도 기준으로 보여 준다.
  const currentLacking = !!current && current.some(isEmpty);
  const basis = choice === "prev" && prev ? "prev" : choice === "current" || !prev ? "current" : currentLacking ? "prev" : "current";
  const shown = basis === "prev" ? prev : current;
  // 전년도 기준 선수는 전년도 ID라 고유번호 경로로 연결한다(올해 기록이 있으면 올해 상세로 이동).
  const hrefOf = basis === "prev" && prevYear ? (p: Player) => playerHref(p, prevYear, year) : undefined;
  const showSample = basis === "current" && includeUnq;

  return (
    <section className="versus-section">
      <div className="pct-card__head">
        <h3 className="heading-md">{title}</h3>
        {prev && (
          <div className="career-mode-toggle pct-card__base" role="group" aria-label="주요 선수 기준">
            <button className={basis === "current" ? "active" : ""} onClick={() => setChoice("current")}>{year} 시즌</button>
            <button className={basis === "prev" ? "active" : ""} onClick={() => setChoice("prev")}>{prevYear} 기준</button>
          </div>
        )}
      </div>
      {basis === "current" && (
        <label className="qual-toggle top-players__unq">
          <input type="checkbox" checked={includeUnq} onChange={(e) => setUnq(e.target.checked)} />
          규정 미달 포함
        </label>
      )}
      <p className="caption muted">
        {basis === "current"
          ? includeUnq
            ? "규정 미달 선수 포함(10타석·3이닝 이상) OPS·ERA 상위 3명 · 오른쪽 작은 글씨 = 타석·이닝"
            : "규정타석·규정이닝 충족 선수 중 OPS·ERA 상위 3명"
          : `${prevYear} 시즌 규정 충족 선수 중 올해도 로스터에 있는 선수 · 졸업생 제외 · 학년은 ${year} 기준`}
      </p>
      {unq === "auto" && includeUnq && basis === "current" && (
        <p className="caption top-players__auto">규정을 채운 선수가 없는 학교가 있어 규정 미달 선수까지 포함해 보여 줍니다.</p>
      )}
      {choice === "auto" && basis === "prev" && (
        <p className="caption top-players__auto">{year} 시즌은 아직 규정을 채운 선수가 없어 {prevYear} 기준으로 보여 줍니다.</p>
      )}
      <div className={`versus-top ${teams.length === 1 ? "versus-top--single" : ""}`}>
        {teams.map((team, i) => (
          <div key={team} className="versus-top__team">
            {teams.length > 1 && (
              <h4 className="versus-top__name"><Link to={`/team/${encodeURIComponent(teamKey(team))}`}>{teamKey(team)}</Link></h4>
            )}
            <TopList title="타자 OPS" players={shown?.[i]?.batters ?? []} value={opsText} hrefOf={hrefOf}
              sample={showSample ? (p) => `${p.batting?.pa ?? 0}타석` : undefined}
              emptyText={basis === "prev" ? "해당 재학생 없음" : showSample ? "10타석 이상 선수 없음" : undefined} />
            <TopList title="투수 ERA" players={shown?.[i]?.pitchers ?? []} value={eraText} hrefOf={hrefOf}
              sample={showSample ? (p) => `${p.pitching?.ip ?? 0}이닝` : undefined}
              emptyText={basis === "prev" ? "해당 재학생 없음" : showSample ? "3이닝 이상 선수 없음" : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}
