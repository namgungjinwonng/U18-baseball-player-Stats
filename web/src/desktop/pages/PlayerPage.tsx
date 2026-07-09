import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  useLeagueAverages, usePlayer, usePlayerIndex, usePlayerMatchups, usePlayerProfile,
  useTournamentMatchups, useTournaments,
} from "../../shared/data";
import { rate, dec2, inn, int, formatDate } from "../../shared/format";
import { battingAdvanced, pitchingAdvanced, pct, dec1, signed1 } from "../../shared/sabermetrics";
import { SaberTerm } from "../../shared/SaberTerm";
import { batsThrowsLabel, groupMatchupsByTeam, indexById, matchupOpponentMeta } from "../../shared/matchup";
import { filterPlayerStats, groupLogByTitle } from "../../shared/playerStats";
import { Fold } from "../../shared/Fold";
import { TournamentPicker } from "../../shared/filters";
import { Chip } from "../../design/ui";
import { KbsaLink } from "../../shared/KbsaLink";
import type { BattingStats, GameLogEntry, LeagueRates, Matchup, PitchingStats, PlayerIndexEntry, PlayerProfile } from "../../shared/types";

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function SaberStat({ abbr, label, v }: { abbr: string; label?: string; v: string }) {
  return (
    <div className="stat">
      <div className="k">
        <SaberTerm abbr={abbr}>{label}</SaberTerm>
      </div>
      <div className="v">{v}</div>
    </div>
  );
}

function BattingStrip({ b }: { b: BattingStats }) {
  // undefined 값은 "-" 통일 표기. (시합 필터 재집계 시 sh/sf/ibb/e 등은 측정 불가)
  const n = (v: number | undefined) => (v == null ? "-" : String(v));
  return (
    <div className="stat-strip stat-strip--compact">
      {/* 타율도 클릭 시 공식·리그평균 모달 (세이버 항목과 동일 UX) */}
      <SaberStat abbr="AVG" label="타율" v={rate(b.avg)} />
      <Stat k="경기" v={n(b.g)} />
      <Stat k="타석" v={n(b.pa)} />
      <Stat k="타수" v={n(b.ab)} />
      <Stat k="안타" v={n(b.h)} />
      <Stat k="2루타" v={n(b.b2)} />
      <Stat k="3루타" v={n(b.b3)} />
      <Stat k="홈런" v={n(b.hr)} />
      <Stat k="타점" v={n(b.rbi)} />
      <Stat k="득점" v={n(b.r)} />
      <Stat k="도루" v={n(b.sb)} />
      <Stat k="볼넷" v={n(b.bb)} />
      <Stat k="고의4구" v={n(b.ibb)} />
      <Stat k="사구" v={n(b.hbp)} />
      <Stat k="삼진" v={n(b.so)} />
      <Stat k="희타" v={n(b.sh)} />
      <Stat k="희비" v={n(b.sf)} />
      <Stat k="실책" v={n(b.e)} />
      {/* OBP·SLG·OPS 는 세이버메트릭스 섹션 중복 — 제거 */}
    </div>
  );
}

function BattingSaber({ b, lg }: { b: BattingStats; lg?: LeagueRates | null }) {
  const a = battingAdvanced(b, lg);
  return (
    <div className="stat-strip stat-strip--compact">
      <SaberStat abbr="OPS" v={rate(a.ops)} />
      <SaberStat abbr="ISO" v={rate(a.iso)} />
      <SaberStat abbr="BABIP" v={rate(a.babip)} />
      <SaberStat abbr="BB%" v={pct(a.bbPct)} />
      <SaberStat abbr="K%" v={pct(a.kPct)} />
      <SaberStat abbr="BB/K" v={dec2(a.bbK)} />
      <SaberStat abbr="wOBA" v={rate(a.woba)} />
      {a.wraa != null && <SaberStat abbr="wRAA" v={signed1(a.wraa)} />}
      {a.wrcPlus != null && <SaberStat abbr="wRC+" v={int(a.wrcPlus)} />}
      {a.war != null && <SaberStat abbr="WAR_BAT" label="WAR" v={dec1(a.war)} />}
    </div>
  );
}

function PitchingSaber({ p, lg }: { p: PitchingStats; lg?: LeagueRates | null }) {
  const a = pitchingAdvanced(p, lg);
  return (
    <div className="stat-strip stat-strip--compact">
      <SaberStat abbr="WHIP" v={dec2(a.whip)} />
      {a.fip != null && <SaberStat abbr="FIP" v={dec2(a.fip)} />}
      <SaberStat abbr="K/9" v={dec1(a.k9)} />
      <SaberStat abbr="BB/9" v={dec1(a.bb9)} />
      <SaberStat abbr="H/9" v={dec1(a.h9)} />
      <SaberStat abbr="K/BB" v={dec2(a.kbb)} />
      {a.war != null && <SaberStat abbr="WAR_PIT" label="WAR" v={dec1(a.war)} />}
    </div>
  );
}

function PitchingStrip({ p }: { p: PitchingStats }) {
  const n = (v: number | undefined) => (v == null ? "-" : String(v));
  return (
    <div className="stat-strip stat-strip--compact">
      {/* 평균자책도 클릭 시 공식·리그평균 모달 (세이버 항목과 동일 UX) */}
      <SaberStat abbr="ERA" label="평균자책" v={dec2(p.era)} />
      <Stat k="경기" v={n(p.g)} />
      <Stat k="승" v={n(p.w)} />
      <Stat k="패" v={n(p.l)} />
      <Stat k="이닝" v={inn(p.ip)} />
      <Stat k="상대타자" v={n(p.bf)} />
      <Stat k="투구수" v={n(p.np)} />
      <Stat k="피안타" v={n(p.h)} />
      <Stat k="피홈런" v={n(p.hr)} />
      <Stat k="볼넷" v={n(p.bb)} />
      <Stat k="탈삼진" v={n(p.so)} />
      <Stat k="실점" v={n(p.r)} />
      <Stat k="자책" v={n(p.er)} />
      {/* WHIP 는 세이버메트릭스 섹션 중복 — 제거 */}
    </div>
  );
}

// 경기 로그 — 시합별 접이식 그룹. 가장 최근 경기가 속한 그룹만 기본으로 펼친다.
function GameLogTable({ log }: { log: GameLogEntry[] }) {
  const groups = groupLogByTitle(log);
  const latestTitle = log.reduce(
    (acc, g) => (g.date > acc.date ? { date: g.date, title: g.title ?? "기타" } : acc),
    { date: "", title: "" }
  ).title;
  return (
    <section className="player-section">
      <h3>경기 로그</h3>
      {groups.map((grp) => (
        <Fold
          key={grp.title}
          title={grp.title}
          sub={`${grp.entries.length}경기`}
          defaultOpen={groups.length === 1 || grp.title === latestTitle}
        >
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>날짜</th>
                  <th style={{ textAlign: "left" }}>상대</th>
                  <th style={{ textAlign: "left" }}>기록</th>
                </tr>
              </thead>
              <tbody>
                {grp.entries.map((g, i) => (
                  <tr key={`${g.gameId}-${i}`}>
                    <td style={{ textAlign: "left" }}>{formatDate(g.date)}</td>
                    <td style={{ textAlign: "left" }}>{g.opponent}</td>
                    <td style={{ textAlign: "left" }}>{g.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Fold>
      ))}
    </section>
  );
}

// 상대전적 (내가 투수 → 상대 타자 / 내가 타자 → 상대 투수) — 상대 학교별 접이식 그룹.
function MatchupTable({
  title, rows, oppLabel, oppIdOf, oppNameOf, byId,
}: {
  title: string;
  rows: Matchup[];
  oppLabel: string;
  oppIdOf: (m: Matchup) => string;
  oppNameOf: (m: Matchup) => string;
  byId: Map<string, PlayerIndexEntry> | null;
}) {
  if (rows.length === 0) return null;
  const groups = groupMatchupsByTeam(rows, oppIdOf, byId);
  return (
    <section className="player-section">
      <h3>{title}</h3>
      {groups.map((grp) => (
        <Fold
          key={grp.team}
          title={grp.team}
          sub={`${grp.rows.length}명`}
          defaultOpen={groups.length === 1}
        >
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>vs {oppLabel}</th>
                  <th>타율</th>
                  <th>타수</th>
                  <th>안타</th>
                  <th>홈런</th>
                  <th>볼넷</th>
                  <th>삼진</th>
                </tr>
              </thead>
              <tbody>
                {grp.rows.map((m) => {
                  const oppId = oppIdOf(m);
                  const opp = byId?.get(oppId);
                  return (
                    <tr key={`${m.batterId}-${m.pitcherId}`}>
                      <td style={{ textAlign: "left" }}>
                        <span className="muted">vs </span>
                        <Link to={`/player/${oppId}`}>{oppNameOf(m)}</Link>
                        {opp && (
                          <span className="muted" style={{ marginLeft: 6 }}>
                            {/* 학교는 그룹 헤더에 있으므로 학년·투타만 */}
                            {matchupOpponentMeta({ grade: opp.grade, bats: opp.bats, throws: opp.throws })}
                          </span>
                        )}
                      </td>
                      <td className="num">{rate(m.avg)}</td>
                      <td className="num">{m.ab}</td>
                      <td className="num">{m.h}</td>
                      <td className="num">{m.hr}</td>
                      <td className="num">{m.bb}</td>
                      <td className="num">{m.so}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Fold>
      ))}
    </section>
  );
}

// 출신학교 탭 (KBSA player_view 연도별 이력 — 초·중·고 전체)
function SchoolsTab({ profile }: { profile: PlayerProfile | null }) {
  const rows = profile?.schools ?? [];
  if (rows.length === 0) {
    return <div className="state muted">출신학교 정보가 없습니다.</div>;
  }
  return (
    <section className="player-section">
      <h3>출신학교</h3>
      <div className="stat-table__scroll">
        <table className="stat-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>연도</th>
              <th style={{ textAlign: "left" }}>지역</th>
              <th style={{ textAlign: "left" }}>소속</th>
              <th style={{ textAlign: "left" }}>포지션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={`${s.year}-${s.school}-${i}`}>
                <td style={{ textAlign: "left" }}>{s.year}</td>
                <td style={{ textAlign: "left" }} className="muted">{s.region ?? "-"}</td>
                <td style={{ textAlign: "left" }}>{s.school}</td>
                <td style={{ textAlign: "left" }} className="muted">{s.position ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// 수상내역 탭
function AwardsTab({ profile }: { profile: PlayerProfile | null }) {
  const rows = profile?.awards ?? [];
  if (rows.length === 0) {
    return <div className="state muted">수상내역이 없습니다.</div>;
  }
  return (
    <section className="player-section">
      <h3>수상내역</h3>
      <div className="stat-table__scroll">
        <table className="stat-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>연도</th>
              <th style={{ textAlign: "left" }}>대회명</th>
              <th style={{ textAlign: "left" }}>수상명</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={`${a.year}-${a.award}-${i}`}>
                <td style={{ textAlign: "left" }}>{a.year}</td>
                <td style={{ textAlign: "left" }}>{a.tournament}</td>
                <td style={{ textAlign: "left" }}><b>{a.award}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type TabId = "batting" | "pitching" | "schools" | "awards";

export function PlayerPage() {
  const { id } = useParams();
  const { data: player, loading, error } = usePlayer(id);
  const { data: matchupsSeason } = usePlayerMatchups(id);
  const { data: index } = usePlayerIndex();
  const { data: tournaments } = useTournaments();
  const { data: profile } = usePlayerProfile(player?.personNo);
  const { data: averages } = useLeagueAverages();
  const [tournamentSlug, setTournamentSlug] = useState("");
  const [tab, setTab] = useState<TabId | null>(null); // null = 자동(타자→투수)
  const byId = useMemo(() => (index ? indexById(index) : null), [index]);

  // slug → title 매핑 후 gameLog 재집계 (필터 없으면 시즌 전체).
  const tournamentTitle = useMemo(
    () => tournaments?.find((t) => t.slug === tournamentSlug)?.title ?? "",
    [tournaments, tournamentSlug]
  );
  const view = useMemo(
    () => (player ? filterPlayerStats(player, tournamentTitle) : null),
    [player, tournamentTitle]
  );
  // 이 선수가 실제로 출전한 시합 slug 집합 (셀렉터 노출 제한).
  const availableSlugs = useMemo(() => {
    if (!tournaments || !player?.gameLog) return undefined;
    const titles = new Set(player.gameLog.map((g) => g.title).filter(Boolean) as string[]);
    return new Set(tournaments.filter((t) => titles.has(t.title)).map((t) => t.slug));
  }, [tournaments, player?.gameLog]);
  // 시합 매치업: 시합 선택 시 시합 전체 매치업에서 이 선수 ID 로 필터.
  const { data: tournamentMatchups } = useTournamentMatchups(tournamentSlug);
  const matchups = useMemo(() => {
    if (!tournamentSlug) return matchupsSeason ?? [];
    if (!player) return [];
    return (tournamentMatchups ?? []).filter(
      (m) => m.batterId === player.id || m.pitcherId === player.id
    );
  }, [tournamentSlug, tournamentMatchups, matchupsSeason, player]);

  // 리그 평균: 시합 필터 시 해당 시합 평균, 아니면 시즌 전체 평균 (wRC+/WAR 기준).
  const lg = useMemo(() => {
    if (!averages) return null;
    if (tournamentSlug) return averages.tournaments[tournamentSlug]?.rates ?? null;
    return averages.overall;
  }, [averages, tournamentSlug]);

  // 시합 필터로 탭 데이터가 사라지면 자동 탭으로 복귀.
  const hasBat = !!view?.batting;
  const hasPit = !!view?.pitching;
  useEffect(() => {
    if (tab === "batting" && !hasBat) setTab(null);
    if (tab === "pitching" && !hasPit) setTab(null);
  }, [tab, hasBat, hasPit]);

  if (loading) return <div className="container state">불러오는 중…</div>;
  if (error || !player) return <div className="container state">선수를 찾을 수 없습니다.</div>;
  const v = view!;

  // 상대전적: 내가 타자인 경우(상대 = 투수), 내가 투수인 경우(상대 = 타자) 로 분리.
  const asBatter = (matchups ?? []).filter((m) => m.batterId === player.id);
  const asPitcher = (matchups ?? []).filter((m) => m.pitcherId === player.id);
  const bt = batsThrowsLabel(player);

  // 활성 탭: 명시 선택 > 타자기록 > 투수기록 > 출신학교.
  const active: TabId = tab ?? (hasBat ? "batting" : hasPit ? "pitching" : "schools");
  // 탭별 경기 로그: 타자탭 = 타격 라인, 투수탭 = 투구 라인 (raw 미보유 구버전은 전체).
  const logFor = (kind: "batting" | "pitching") => {
    const withRaw = v.gameLog.filter((g) => (kind === "batting" ? g.bStat : g.pStat));
    return withRaw.length ? withRaw : v.gameLog;
  };

  return (
    <div className="container page">
      <div className="player-head">
        <h1 className="heading-xl" style={{ marginBottom: 0 }}>{player.name}</h1>
        <div className="player-meta-line">
          <span>{player.team}</span>
          <span>{player.position}</span>
          {player.grade && <span>{player.grade}학년</span>}
          {player.number && <span>{player.number}번</span>}
          {bt && <span>{bt}</span>}
          {profile?.birth && <span>{profile.birth}</span>}
          {profile?.height && profile?.weight && (
            <span>{profile.height}cm·{profile.weight}kg</span>
          )}
        </div>
        <KbsaLink personNo={player.personNo} />
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div className="filter-bar__row filter-bar__row--tournament">
          <TournamentPicker
            value={tournamentSlug}
            onChange={setTournamentSlug}
            availableSlugs={availableSlugs}
          />
        </div>
      </div>

      {/* 타자기록 / 투수기록 / 출신학교 / 수상내역 탭 (기록 탭은 해당 기록 보유 시에만) */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {hasBat && (
          <Chip active={active === "batting"} onClick={() => setTab("batting")}>타자기록</Chip>
        )}
        {hasPit && (
          <Chip active={active === "pitching"} onClick={() => setTab("pitching")}>투수기록</Chip>
        )}
        <Chip active={active === "schools"} onClick={() => setTab("schools")}>출신학교</Chip>
        <Chip active={active === "awards"} onClick={() => setTab("awards")}>수상내역</Chip>
      </div>

      {active === "batting" && v.batting && (
        <>
          <section className="player-section">
            <h3>타자 기록</h3>
            <BattingStrip b={v.batting} />
          </section>
          <section className="player-section">
            <h3>세이버메트릭스 (타자)</h3>
            <BattingSaber b={v.batting} lg={lg} />
          </section>
          <GameLogTable log={logFor("batting")} />
          <MatchupTable
            title="상대전적 — 상대 투수"
            rows={asBatter}
            oppLabel="투수"
            oppIdOf={(m) => m.pitcherId}
            oppNameOf={(m) => m.pitcherName}
            byId={byId}
          />
        </>
      )}

      {active === "pitching" && v.pitching && (
        <>
          <section className="player-section">
            <h3>투수 기록</h3>
            <PitchingStrip p={v.pitching} />
          </section>
          <section className="player-section">
            <h3>세이버메트릭스 (투수)</h3>
            <PitchingSaber p={v.pitching} lg={lg} />
          </section>
          <GameLogTable log={logFor("pitching")} />
          <MatchupTable
            title="상대전적 — 상대 타자"
            rows={asPitcher}
            oppLabel="타자"
            oppIdOf={(m) => m.batterId}
            oppNameOf={(m) => m.batterName}
            byId={byId}
          />
        </>
      )}

      {active === "schools" && <SchoolsTab profile={profile ?? null} />}
      {active === "awards" && <AwardsTab profile={profile ?? null} />}
    </div>
  );
}
