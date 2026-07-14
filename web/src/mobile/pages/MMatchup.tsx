import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayerIndex, usePlayerMatchups, useTournamentMatchups } from "../../shared/data";
import { rate } from "../../shared/format";
import { Chip } from "../../design/ui";
import { TournamentPicker } from "../../shared/filters";
import {
  batsThrowsLabel, facedOpponents, facedSchools, indexById, opposite, playerLabel,
  playerInSeason, searchByRole, sumMatchups, type Role,
} from "../../shared/matchup";
import { Ico } from "../../shared/navIcons";
import type { Matchup, PlayerIndexEntry } from "../../shared/types";
import { useYear } from "../../shared/year";

export function MMatchup() {
  const { year } = useYear();
  const indexState = usePlayerIndex();
  const { data: index } = indexState;
  const [aRole, setARole] = useState<Role>("batter");
  const [query, setQuery] = useState("");
  const [a, setA] = useState<PlayerIndexEntry | null>(null);
  const [school, setSchool] = useState("");
  const [oppId, setOppId] = useState("");
  const [tournamentSlug, setTournamentSlug] = useState("");
  const indexReady = indexState.scope === String(year);
  const seasonA = useMemo(
    () => (a && index && indexReady ? playerInSeason(a, index) : null),
    [a, index, indexReady]
  );
  const matchupState = usePlayerMatchups(seasonA?.id);
  const tournamentState = useTournamentMatchups(tournamentSlug);
  const matchupReady = tournamentSlug
    ? tournamentState.scope === `${year}:${tournamentSlug}`
    : matchupState.scope === `${year}:${seasonA?.id ?? ""}`;
  const matchups = useMemo<Matchup[]>(() => {
    if (!seasonA || !indexReady || !matchupReady) return [];
    if (!tournamentSlug) return matchupState.data ?? [];
    return (tournamentState.data ?? []).filter(
      (m) => m.batterId === seasonA.id || m.pitcherId === seasonA.id
    );
  }, [seasonA, indexReady, matchupReady, tournamentSlug, matchupState.data, tournamentState.data]);

  const byId = useMemo(() => indexById(index ?? []), [index]);
  const candidates = useMemo(
    () => (index && indexReady ? searchByRole(index, aRole, query) : []),
    [index, indexReady, aRole, query]
  );
  const faced = useMemo(
    () => (seasonA && matchupReady ? facedOpponents(matchups, byId, aRole, seasonA.id) : []),
    [seasonA, matchupReady, matchups, byId, aRole]
  );
  const schools = useMemo(() => facedSchools(faced), [faced]);
  const schoolOpps = useMemo(() => faced.filter((f) => f.opponent.team === school), [faced, school]);
  const schoolTotal = useMemo(() => sumMatchups(schoolOpps), [schoolOpps]);
  const sel = schoolOpps.find((f) => f.opponent.id === oppId)?.matchup;

  const previousYear = useRef(year);
  useEffect(() => {
    if (previousYear.current === year) return;
    previousYear.current = year;
    setTournamentSlug("");
    setSchool("");
    setOppId("");
  }, [year]);
  useEffect(() => {
    if (!seasonA || !a || seasonA.id === a.id) return;
    setA(seasonA);
  }, [seasonA, a]);
  useEffect(() => {
    if (school && !schools.some((s) => s.team === school)) setSchool("");
    if (oppId && !schoolOpps.some((f) => f.opponent.id === oppId)) setOppId("");
  }, [school, schools, oppId, schoolOpps]);

  function reset(role: Role) { setARole(role); setA(null); setQuery(""); setSchool(""); setOppId(""); }
  const oppRoleLabel = opposite(aRole) === "pitcher" ? "투수" : "타자";

  return (
    <div className="m-page">
      <h2 className="heading-xl"><Ico name="matchup" variant="title" />상대전적</h2>
      <p className="caption" style={{ marginTop: -8, marginBottom: 16 }}>타자 vs 투수</p>

      <div className="filter-bar">
        <div className="filter-bar__row filter-bar__row--tournament">
          <TournamentPicker value={tournamentSlug} onChange={setTournamentSlug} />
        </div>
      </div>

      <label className="caption">① 기준 선수 유형</label>
      <div className="m-tabs" style={{ marginTop: 8 }}>
        <Chip active={aRole === "batter"} onClick={() => reset("batter")}>타자</Chip>
        <Chip active={aRole === "pitcher"} onClick={() => reset("pitcher")}>투수</Chip>
      </div>

      <label className="caption">② {aRole === "batter" ? "타자" : "투수"} 이름 검색</label>
      {a ? (
        <div className="picked" style={{ maxWidth: "none", marginTop: 8 }}>
          <span><b>{a.name}</b> <span className="muted">{playerLabel(a).replace(`${a.name} `, "")}</span></span>
          <button className="btn btn--secondary btn--sm" onClick={() => reset(aRole)}>변경</button>
        </div>
      ) : (
        <>
          <div className="search-pill" style={{ marginTop: 8 }}>
            <span aria-hidden>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={`${aRole === "batter" ? "타자" : "투수"} 이름`} aria-label="선수 이름 검색" />
          </div>
          {query && (
            <div className="ac-list">
              {candidates.length === 0 && <div className="ac-empty muted">결과 없음</div>}
              {candidates.map((p) => (
                <button key={p.id} className="ac-item" onClick={() => { setA(p); setQuery(""); }}>
                  {playerLabel(p)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {a && (
        <>
          <label className="caption" style={{ display: "block", marginTop: 16 }}>
            ③ 상대한 학교 ({schools.length}개)
          </label>
          {!indexReady || (seasonA && !matchupReady) ? (
            <div className="state muted">{year} 시즌 상대전적을 불러오는 중…</div>
          ) : !seasonA ? (
            <div className="state muted">이 연도에는 맞대결 기록이 없습니다.</div>
          ) : schools.length === 0 ? (
            <div className="state muted">이 연도에는 맞대결 기록이 없습니다.</div>
          ) : (
            <select className="m-select" value={school} onChange={(e) => { setSchool(e.target.value); setOppId(""); }}>
              <option value="">학교 선택</option>
              {schools.map((s) => (
                <option key={s.team} value={s.team}>{s.team} · {s.count}명</option>
              ))}
            </select>
          )}
        </>
      )}

      {school && (
        <>
          <h3 className="heading-md" style={{ marginTop: 8 }}>{school} 상대 {oppRoleLabel}</h3>
          {schoolTotal && (
            <p className="caption" style={{ marginBottom: 8 }}>
              학교 합계 {schoolTotal.ab}타수 {schoolTotal.h}안타 · {rate(schoolTotal.avg)}
            </p>
          )}
          {schoolOpps.map(({ opponent, matchup }) => (
            <div key={opponent.id} className="m-result"
              style={{ cursor: "pointer", flexDirection: "column", alignItems: "stretch", gap: 4 }}
              onClick={() => setOppId(opponent.id === oppId ? "" : opponent.id)}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>
                  {opponent.grade ? `${opponent.grade}학년 ` : ""}<b>{opponent.name}</b>
                  {batsThrowsLabel(opponent) && (
                    <span className="muted"> · {batsThrowsLabel(opponent)}</span>
                  )}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{rate(matchup.avg)} ({matchup.ab}-{matchup.h})</span>
              </div>
              {opponent.id === oppId && sel && (
                <div className="m-strip" style={{ marginTop: 8 }}>
                  <div className="cell"><div className="k">타석</div><div className="v">{sel.pa}</div></div>
                  <div className="cell"><div className="k">타수</div><div className="v">{sel.ab}</div></div>
                  <div className="cell"><div className="k">안타</div><div className="v">{sel.h}</div></div>
                  <div className="cell"><div className="k">2루타</div><div className="v">{sel.b2}</div></div>
                  <div className="cell"><div className="k">3루타</div><div className="v">{sel.b3}</div></div>
                  <div className="cell"><div className="k">홈런</div><div className="v">{sel.hr}</div></div>
                  <div className="cell"><div className="k">볼넷</div><div className="v">{sel.bb}</div></div>
                  <div className="cell"><div className="k">사구</div><div className="v">{sel.hbp}</div></div>
                  <div className="cell"><div className="k">삼진</div><div className="v">{sel.so}</div></div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
