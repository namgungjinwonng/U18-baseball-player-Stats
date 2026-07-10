import { useMemo, useState } from "react";
import { usePlayerIndex, usePlayerMatchups, useTournamentMatchups } from "../../shared/data";
import { rate } from "../../shared/format";
import { Chip } from "../../design/ui";
import { TournamentPicker } from "../../shared/filters";
import {
  batsThrowsLabel, facedOpponents, facedSchools, indexById, opposite, playerLabel,
  searchByRole, sumMatchups, type Role,
} from "../../shared/matchup";
import { Ico } from "../../shared/navIcons";
import type { Matchup, PlayerIndexEntry } from "../../shared/types";

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="stat"><div className="k">{k}</div><div className="v">{v}</div></div>;
}
function MatchupStrip({ m }: { m: Matchup }) {
  return (
    <div className="stat-strip">
      <Stat k="타율" v={rate(m.avg)} />
      <Stat k="타석" v={String(m.pa)} />
      <Stat k="타수" v={String(m.ab)} />
      <Stat k="안타" v={String(m.h)} />
      <Stat k="2루타" v={String(m.b2)} />
      <Stat k="3루타" v={String(m.b3)} />
      <Stat k="홈런" v={String(m.hr)} />
      <Stat k="볼넷" v={String(m.bb)} />
      <Stat k="사구" v={String(m.hbp)} />
      <Stat k="삼진" v={String(m.so)} />
    </div>
  );
}

export function MatchupPage() {
  const { data: index } = usePlayerIndex();
  const [aRole, setARole] = useState<Role>("batter");
  const [query, setQuery] = useState("");
  const [a, setA] = useState<PlayerIndexEntry | null>(null);
  const [school, setSchool] = useState("");
  const [oppId, setOppId] = useState(""); // 선택적: 특정 상대 선수
  const [tournamentSlug, setTournamentSlug] = useState("");
  const { data: matchupsSeason } = usePlayerMatchups(a?.id); // A 선수 샤드만 로드
  const { data: tournamentMatchups } = useTournamentMatchups(tournamentSlug);
  // 시합 미선택 → 시즌 샤드(A 선수만). 선택 → 그 시합 전체 매치업에서 A 선수 ID 로 필터.
  const matchups = useMemo<Matchup[]>(() => {
    if (!tournamentSlug) return matchupsSeason ?? [];
    if (!a) return [];
    return (tournamentMatchups ?? []).filter((m) => m.batterId === a.id || m.pitcherId === a.id);
  }, [tournamentSlug, tournamentMatchups, matchupsSeason, a]);

  const byId = useMemo(() => indexById(index ?? []), [index]);
  const candidates = useMemo(
    () => (index ? searchByRole(index, aRole, query) : []),
    [index, aRole, query]
  );
  const faced = useMemo(
    () => (a && matchups ? facedOpponents(matchups, byId, aRole, a.id) : []),
    [a, matchups, byId, aRole]
  );
  const schools = useMemo(() => facedSchools(faced), [faced]);
  const schoolOpps = useMemo(
    () => faced.filter((f) => f.opponent.team === school),
    [faced, school]
  );
  const schoolTotal = useMemo(() => sumMatchups(schoolOpps), [schoolOpps]);
  const selectedOpp = schoolOpps.find((f) => f.opponent.id === oppId)?.matchup;

  function reset(role: Role) {
    setARole(role); setA(null); setQuery(""); setSchool(""); setOppId("");
  }
  const oppRoleLabel = opposite(aRole) === "pitcher" ? "투수" : "타자";

  return (
    <div className="container page">
      <div className="section-head">
        <h2 className="heading-xl"><Ico name="matchup" variant="title" />상대전적 · 타자 vs 투수</h2>
      </div>

      {/* 시합 필터 (선택) — 시합 범위 안에서만 매치업 집계 */}
      <div className="filter-bar">
        <div className="filter-bar__row filter-bar__row--tournament">
          <TournamentPicker value={tournamentSlug} onChange={setTournamentSlug} />
        </div>
      </div>

      {/* ① 기준 선수 유형 + 검색 */}
      <p className="caption" style={{ marginBottom: 8 }}>① 기준 선수 유형</p>
      <div className="tabs">
        <Chip active={aRole === "batter"} onClick={() => reset("batter")}>타자</Chip>
        <Chip active={aRole === "pitcher"} onClick={() => reset("pitcher")}>투수</Chip>
      </div>

      <p className="caption" style={{ margin: "16px 0 8px" }}>
        ② {aRole === "batter" ? "타자" : "투수"} 이름 검색
      </p>
      {a ? (
        <div className="picked">
          <span><b>{a.name}</b> <span className="muted">{playerLabel(a).replace(`${a.name} `, "")}</span></span>
          <button className="btn btn--secondary btn--sm" onClick={() => reset(aRole)}>변경</button>
        </div>
      ) : (
        <div className="ac" style={{ maxWidth: 480 }}>
          <div className="search-pill">
            <span aria-hidden>⌕</span>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={`${aRole === "batter" ? "타자" : "투수"} 이름 입력`} aria-label="선수 이름 검색" />
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
        </div>
      )}

      {/* ③ 상대한 학교 리스트 */}
      {a && (
        <>
          <p className="caption" style={{ margin: "20px 0 8px" }}>
            ③ 상대한 학교 ({schools.length}개)
          </p>
          {schools.length === 0 ? (
            <div className="state muted">맞대결 기록이 있는 상대가 없습니다.</div>
          ) : (
            <div className="tabs">
              {schools.map((s) => (
                <Chip key={s.team} active={s.team === school}
                  onClick={() => { setSchool(s.team); setOppId(""); }}>
                  {s.team} · {s.count}명
                </Chip>
              ))}
            </div>
          )}
        </>
      )}

      {/* ④ 학교의 상대 선수 전체 + (선택적) 특정 선수 상세 */}
      {school && (
        <>
          <div className="section-head" style={{ margin: "20px 0 8px" }}>
            <h3 className="heading-md">{school} 상대 {oppRoleLabel} ({schoolOpps.length}명)</h3>
            {schoolTotal && <span className="caption">학교 합계 {schoolTotal.ab}타수 {schoolTotal.h}안타 · {rate(schoolTotal.avg)}</span>}
          </div>
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>학년</th>
                  <th style={{ textAlign: "left" }}>{oppRoleLabel}</th>
                  <th style={{ textAlign: "left" }}>투타</th>
                  <th>타율</th><th>타석</th><th>타수</th><th>안타</th>
                  <th>2타</th><th>3타</th><th>홈런</th><th>볼넷</th><th>사구</th><th>삼진</th>
                </tr>
              </thead>
              <tbody>
                {schoolOpps.map(({ opponent, matchup }) => (
                  <tr key={opponent.id} className={opponent.id === oppId ? "" : ""}
                    style={{ cursor: "pointer", background: opponent.id === oppId ? "var(--color-soft-cloud)" : undefined }}
                    onClick={() => setOppId(opponent.id === oppId ? "" : opponent.id)}>
                    <td style={{ textAlign: "left" }}>{opponent.grade ? `${opponent.grade}학년` : "-"}</td>
                    <td style={{ textAlign: "left" }}>{opponent.name}</td>
                    <td style={{ textAlign: "left" }}>{batsThrowsLabel(opponent) || "-"}</td>
                    <td className="num">{rate(matchup.avg)}</td>
                    <td className="num">{matchup.pa}</td>
                    <td className="num">{matchup.ab}</td>
                    <td className="num">{matchup.h}</td>
                    <td className="num">{matchup.b2}</td>
                    <td className="num">{matchup.b3}</td>
                    <td className="num">{matchup.hr}</td>
                    <td className="num">{matchup.bb}</td>
                    <td className="num">{matchup.hbp}</td>
                    <td className="num">{matchup.so}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedOpp && (
            <>
              <h3 className="heading-md" style={{ marginTop: 20 }}>상세 상대전적</h3>
              <MatchupStrip m={selectedOpp} />
            </>
          )}
        </>
      )}
    </div>
  );
}
