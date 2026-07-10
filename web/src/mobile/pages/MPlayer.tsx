import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  useLeagueAverages, usePlayer, usePlayerIndex, usePlayerMatchups, usePlayerProfile,
  useTournamentMatchups, useTournaments,
} from "../../shared/data";
import { rate, dec2, inn, int, formatDate } from "../../shared/format";
import { battingAdvanced, pitchingAdvanced, pct, dec1, signed1 } from "../../shared/sabermetrics";
import { SaberTerm } from "../../shared/SaberTerm";
import { batsThrowsLabel, groupMatchupsByTeam, indexById, matchupOpponentMeta, matchupsVsSchool, sameSchool } from "../../shared/matchup";
import { filterPlayerStats, groupLogByTitle } from "../../shared/playerStats";
import { Fold } from "../../shared/Fold";
import { TournamentPicker, filterFromQuery } from "../../shared/filters";
import { Chip } from "../../design/ui";
import { KbsaLink } from "../../shared/KbsaLink";
import type { GameLogEntry, Matchup, PlayerIndexEntry, PlayerProfile } from "../../shared/types";

type TabId = "batting" | "pitching" | "schools" | "awards";

function MSchools({ profile }: { profile: PlayerProfile | null }) {
  const rows = profile?.schools ?? [];
  if (rows.length === 0) return <div className="state muted">출신학교 정보가 없습니다.</div>;
  return (
    <section className="player-section">
      <h3>출신학교</h3>
      {rows.map((s, i) => (
        <div key={`${s.year}-${s.school}-${i}`} className="m-result">
          <span>
            <b>{s.school}</b>
            {s.region && <span className="muted"> · {s.region}</span>}
            {s.position && <span className="muted"> · {s.position}</span>}
          </span>
          <span className="caption">{s.year}</span>
        </div>
      ))}
    </section>
  );
}

function MAwards({ profile }: { profile: PlayerProfile | null }) {
  const rows = profile?.awards ?? [];
  if (rows.length === 0) return <div className="state muted">수상내역이 없습니다.</div>;
  return (
    <section className="player-section">
      <h3>수상내역</h3>
      {rows.map((a, i) => (
        <div key={`${a.year}-${a.award}-${i}`} className="m-result"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <span className="caption">{a.year} · {a.tournament}</span>
          <span><b>{a.award}</b></span>
        </div>
      ))}
    </section>
  );
}

// 경기 로그 한 경기 카드 — 클릭 시 그 시합 상대 학교의 상대전적(상대 선수별 기록)을 펼친다.
function MGameLogEntry({
  g, role, matchups, byId,
}: {
  g: GameLogEntry;
  role: "batter" | "pitcher";
  matchups: Matchup[];
  byId: Map<string, PlayerIndexEntry> | null;
}) {
  const [open, setOpen] = useState(false);
  const oppIdOf = (m: Matchup) => (role === "batter" ? m.pitcherId : m.batterId);
  const oppNameOf = (m: Matchup) => (role === "batter" ? m.pitcherName : m.batterName);
  const vs = useMemo(
    () => matchupsVsSchool(matchups, oppIdOf, byId, g.opponent),
    [matchups, byId, g.opponent, role]
  );
  const canOpen = vs.length > 0;
  return (
    <>
      <div
        className="m-result"
        style={{ flexDirection: "column", alignItems: "flex-start", gap: 4, cursor: canOpen ? "pointer" : "default" }}
        onClick={() => canOpen && setOpen((o) => !o)}
      >
        <span className="caption">
          {formatDate(g.date)} · {g.opponent}
          {canOpen && <span aria-hidden> {open ? "▾" : "▸"}</span>}
        </span>
        <span>{g.line}</span>
      </div>
      {open && (
        <div className="m-gamelog-vs">
          {vs.map((m) => {
            const opp = byId?.get(oppIdOf(m));
            return (
              <div key={`${m.batterId}-${m.pitcherId}`} className="m-result">
                <span>
                  <span className="muted">vs </span>
                  <Link to={`/player/${oppIdOf(m)}`}>{oppNameOf(m)}</Link>
                  {opp && (
                    <span className="muted" style={{ marginLeft: 6 }}>
                      {matchupOpponentMeta({ grade: opp.grade, bats: opp.bats, throws: opp.throws })}
                    </span>
                  )}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {rate(m.avg)} ({m.ab}-{m.h})
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function MPlayer() {
  const { id } = useParams();
  const location = useLocation();
  const { data: p, loading, error } = usePlayer(id);
  const { data: matchupsSeason } = usePlayerMatchups(id);
  const { data: index } = usePlayerIndex();
  const { data: tournaments } = useTournaments();
  const { data: profile } = usePlayerProfile(p?.personNo);
  const { data: averages } = useLeagueAverages();
  // 기록·랭킹 목록에서 시합 필터를 건 채 넘어오면 URL(?t=slug)로 그 필터를 이어받는다.
  const [tournamentSlug, setTournamentSlug] = useState(() => filterFromQuery(location.search).tournament);
  const [tab, setTab] = useState<TabId | null>(null); // null = 자동(타자→투수)
  const byId = useMemo(() => (index ? indexById(index) : null), [index]);
  const tournamentTitle = useMemo(
    () => tournaments?.find((t) => t.slug === tournamentSlug)?.title ?? "",
    [tournaments, tournamentSlug]
  );
  const view = useMemo(() => (p ? filterPlayerStats(p, tournamentTitle) : null), [p, tournamentTitle]);
  const availableSlugs = useMemo(() => {
    if (!tournaments || !p?.gameLog) return undefined;
    const titles = new Set(p.gameLog.map((g) => g.title).filter(Boolean) as string[]);
    return new Set(tournaments.filter((t) => titles.has(t.title)).map((t) => t.slug));
  }, [tournaments, p?.gameLog]);
  const { data: tournamentMatchups } = useTournamentMatchups(tournamentSlug);
  const matchups = useMemo(() => {
    if (!tournamentSlug) return matchupsSeason ?? [];
    if (!p) return [];
    return (tournamentMatchups ?? []).filter(
      (m) => m.batterId === p.id || m.pitcherId === p.id
    );
  }, [tournamentSlug, tournamentMatchups, matchupsSeason, p]);

  // 리그 평균: 시합 필터 시 해당 시합, 아니면 시즌 전체 (wRC+/WAR 기준).
  const lg = useMemo(() => {
    if (!averages) return null;
    if (tournamentSlug) return averages.tournaments[tournamentSlug]?.rates ?? null;
    return averages.overall;
  }, [averages, tournamentSlug]);

  const hasBat = !!view?.batting;
  const hasPit = !!view?.pitching;
  useEffect(() => {
    if (tab === "batting" && !hasBat) setTab(null);
    if (tab === "pitching" && !hasPit) setTab(null);
  }, [tab, hasBat, hasPit]);

  if (loading) return <div className="m-page state">불러오는 중…</div>;
  if (error || !p) return <div className="m-page state">선수를 찾을 수 없습니다.</div>;
  const v = view!;

  const asBatter = (matchups ?? []).filter((m) => m.batterId === p.id);
  const asPitcher = (matchups ?? []).filter((m) => m.pitcherId === p.id);
  const bt = batsThrowsLabel(p);
  const active: TabId = tab ?? (hasBat ? "batting" : hasPit ? "pitching" : "schools");
  const logFor = (kind: "batting" | "pitching") => {
    const withRaw = v.gameLog.filter((g) => (kind === "batting" ? g.bStat : g.pStat));
    return withRaw.length ? withRaw : v.gameLog;
  };

  // 경기 로그 — 시합별 접이식 그룹 (기본 모두 접힘).
  const gameLogSection = (kind: "batting" | "pitching") => {
    const log = logFor(kind);
    const groups = groupLogByTitle(log);
    return (
      <section className="player-section">
        <h3>경기 로그</h3>
        {groups.map((grp) => (
          <Fold key={grp.title} title={grp.title} sub={`${grp.entries.length}경기`}>
            {grp.entries.map((g, i) => (
              <MGameLogEntry
                key={`${g.gameId}-${i}`}
                g={g}
                role={kind === "batting" ? "batter" : "pitcher"}
                matchups={kind === "batting" ? asBatter : asPitcher}
                byId={byId}
              />
            ))}
          </Fold>
        ))}
      </section>
    );
  };

  // 상대전적 — 상대 학교별 접이식 그룹. 경기 로그 드릴다운에 이미 보이는 학교는 제외(중복 방지).
  const matchupSection = (
    title: string, rows: Matchup[], oppIdOf: (m: Matchup) => string, oppNameOf: (m: Matchup) => string,
    excludeSchools: string[]
  ) => {
    if (rows.length === 0) return null;
    const groups = groupMatchupsByTeam(rows, oppIdOf, byId).filter(
      (grp) => !excludeSchools.some((s) => sameSchool(grp.team, s))
    );
    if (groups.length === 0) return null;
    return (
      <section className="player-section">
        <h3>{title}</h3>
        <p className="caption-sm" style={{ margin: "0 0 8px", color: "var(--color-mute)" }}>
          경기 로그에 없는 상대만 표시됩니다.
        </p>
        {groups.map((grp) => (
          <Fold key={grp.team} title={grp.team} sub={`${grp.rows.length}명`}>
            {grp.rows.map((m) => {
              const oppId = oppIdOf(m);
              const opp = byId?.get(oppId);
              return (
                <div key={`${m.batterId}-${m.pitcherId}`} className="m-result">
                  <span>
                    <span className="muted">vs </span>
                    <Link to={`/player/${oppId}`}>{oppNameOf(m)}</Link>
                    {opp && (
                      <span className="muted" style={{ marginLeft: 6 }}>
                        {/* 학교는 그룹 헤더에 있으므로 학년·투타만 */}
                        {matchupOpponentMeta({ grade: opp.grade, bats: opp.bats, throws: opp.throws })}
                      </span>
                    )}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {rate(m.avg)} ({m.ab}-{m.h})
                  </span>
                </div>
              );
            })}
          </Fold>
        ))}
      </section>
    );
  };

  return (
    <div className="m-page">
      <h2 className="heading-xl" style={{ marginBottom: 0 }}>
        {p.name}
      </h2>
      <div className="player-meta-line">
        <span>{p.team}</span>
        <span>{p.position}</span>
        {p.grade && <span>{p.grade}학년</span>}
        {p.number && <span>{p.number}번</span>}
        {bt && <span>{bt}</span>}
        {profile?.birth && <span>{profile.birth}</span>}
        {profile?.height && profile?.weight && <span>{profile.height}cm·{profile.weight}kg</span>}
      </div>
      {p.personNo && (
        <div style={{ margin: "0 0 12px" }}>
          <KbsaLink personNo={p.personNo} />
        </div>
      )}

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="filter-bar__row filter-bar__row--tournament">
          <TournamentPicker
            value={tournamentSlug}
            onChange={setTournamentSlug}
            availableSlugs={availableSlugs}
          />
        </div>
      </div>

      {/* 타자기록 / 투수기록 / 출신학교 / 수상내역 탭 (기록 탭은 해당 기록 보유 시에만) */}
      <div className="m-tabs" style={{ marginBottom: 12 }}>
        {hasBat && <Chip active={active === "batting"} onClick={() => setTab("batting")}>타자기록</Chip>}
        {hasPit && <Chip active={active === "pitching"} onClick={() => setTab("pitching")}>투수기록</Chip>}
        <Chip active={active === "schools"} onClick={() => setTab("schools")}>출신학교</Chip>
        <Chip active={active === "awards"} onClick={() => setTab("awards")}>수상내역</Chip>
      </div>

      {active === "batting" && v.batting && (() => {
        // undefined 값은 "-" 로 통일 표기 (시합 필터 재집계 시 sh/sf/ibb/e 등은 측정 불가).
        const n = (x?: number) => (x == null ? "-" : String(x));
        const a = battingAdvanced(v.batting, lg);
        return (
          <>
            <section className="player-section">
              <h3>타자 기록</h3>
              <div className="m-strip">
                {/* 타율도 클릭 시 공식·리그평균 모달 (세이버 항목과 동일 UX) */}
                <div className="cell">
                  <div className="k"><SaberTerm abbr="AVG">타율</SaberTerm></div>
                  <div className="v">{rate(v.batting.avg)}</div>
                </div>
                {/* 비율/계산 지표(OBP·SLG·OPS) 는 세이버메트릭스 섹션에서만 노출 — 중복 제거. */}
                {([
                  ["경기", n(v.batting.g)], ["타석", n(v.batting.pa)],
                  ["타수", n(v.batting.ab)], ["안타", n(v.batting.h)], ["2루타", n(v.batting.b2)],
                  ["3루타", n(v.batting.b3)], ["홈런", n(v.batting.hr)], ["타점", n(v.batting.rbi)],
                  ["득점", n(v.batting.r)], ["도루", n(v.batting.sb)], ["볼넷", n(v.batting.bb)],
                  ["고의4구", n(v.batting.ibb)], ["사구", n(v.batting.hbp)], ["삼진", n(v.batting.so)],
                  ["희타", n(v.batting.sh)], ["희비", n(v.batting.sf)], ["실책", n(v.batting.e)],
                ] as [string, string | number][]).map(([k, val]) => (
                  <div className="cell" key={k}><div className="k">{k}</div><div className="v">{val}</div></div>
                ))}
              </div>
            </section>
            <section className="player-section">
              <h3>세이버메트릭스 (타자)</h3>
              <div className="m-strip">
                <div className="cell"><div className="k"><SaberTerm abbr="OPS" /></div><div className="v">{rate(a.ops)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="ISO" /></div><div className="v">{rate(a.iso)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="BABIP" /></div><div className="v">{rate(a.babip)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="BB%" /></div><div className="v">{pct(a.bbPct)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="K%" /></div><div className="v">{pct(a.kPct)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="BB/K" /></div><div className="v">{dec2(a.bbK)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="wOBA" /></div><div className="v">{rate(a.woba)}</div></div>
                {a.wraa != null && <div className="cell"><div className="k"><SaberTerm abbr="wRAA" /></div><div className="v">{signed1(a.wraa)}</div></div>}
                {a.wrcPlus != null && <div className="cell"><div className="k"><SaberTerm abbr="wRC+" /></div><div className="v">{int(a.wrcPlus)}</div></div>}
                {a.war != null && <div className="cell"><div className="k"><SaberTerm abbr="WAR_BAT">WAR</SaberTerm></div><div className="v">{dec1(a.war)}</div></div>}
              </div>
            </section>
            {gameLogSection("batting")}
            {matchupSection("상대전적 — 상대 투수", asBatter, (m) => m.pitcherId, (m) => m.pitcherName, logFor("batting").map((g) => g.opponent))}
          </>
        );
      })()}

      {active === "pitching" && v.pitching && (() => {
        const n = (x?: number) => (x == null ? "-" : String(x));
        const a = pitchingAdvanced(v.pitching, lg);
        return (
          <>
            <section className="player-section">
              <h3>투수 기록</h3>
              <div className="m-strip">
                {/* 평균자책도 클릭 시 공식·리그평균 모달 (세이버 항목과 동일 UX) */}
                <div className="cell">
                  <div className="k"><SaberTerm abbr="ERA">평균자책</SaberTerm></div>
                  <div className="v">{dec2(v.pitching.era)}</div>
                </div>
                {/* 비율/계산 지표(WHIP) 는 세이버메트릭스 섹션에서만 노출. */}
                {([
                  ["경기", n(v.pitching.g)], ["승", n(v.pitching.w)],
                  ["패", n(v.pitching.l)], ["이닝", inn(v.pitching.ip)], ["상대타자", n(v.pitching.bf)],
                  ["투구수", n(v.pitching.np)], ["피안타", n(v.pitching.h)], ["피홈런", n(v.pitching.hr)],
                  ["볼넷", n(v.pitching.bb)], ["탈삼진", n(v.pitching.so)], ["실점", n(v.pitching.r)],
                  ["자책", n(v.pitching.er)],
                ] as [string, string | number][]).map(([k, val]) => (
                  <div className="cell" key={k}><div className="k">{k}</div><div className="v">{val}</div></div>
                ))}
              </div>
            </section>
            <section className="player-section">
              <h3>세이버메트릭스 (투수)</h3>
              <div className="m-strip">
                <div className="cell"><div className="k"><SaberTerm abbr="WHIP" /></div><div className="v">{dec2(a.whip)}</div></div>
                {a.fip != null && <div className="cell"><div className="k"><SaberTerm abbr="FIP" /></div><div className="v">{dec2(a.fip)}</div></div>}
                <div className="cell"><div className="k"><SaberTerm abbr="K/9" /></div><div className="v">{dec1(a.k9)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="BB/9" /></div><div className="v">{dec1(a.bb9)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="H/9" /></div><div className="v">{dec1(a.h9)}</div></div>
                <div className="cell"><div className="k"><SaberTerm abbr="K/BB" /></div><div className="v">{dec2(a.kbb)}</div></div>
                {a.war != null && <div className="cell"><div className="k"><SaberTerm abbr="WAR_PIT">WAR</SaberTerm></div><div className="v">{dec1(a.war)}</div></div>}
              </div>
            </section>
            {gameLogSection("pitching")}
            {matchupSection("상대전적 — 상대 타자", asPitcher, (m) => m.batterId, (m) => m.batterName, logFor("pitching").map((g) => g.opponent))}
          </>
        );
      })()}

      {active === "schools" && <MSchools profile={profile ?? null} />}
      {active === "awards" && <MAwards profile={profile ?? null} />}
    </div>
  );
}
