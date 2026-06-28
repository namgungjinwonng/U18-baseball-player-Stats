import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer, usePlayerIndex, usePlayerMatchups, useTournamentMatchups, useTournaments } from "../../shared/data";
import { rate, dec2, inn, formatDate } from "../../shared/format";
import { battingAdvanced, pitchingAdvanced, pct, dec1 } from "../../shared/sabermetrics";
import { SaberTerm } from "../../shared/SaberTerm";
import { batsThrowsLabel, indexById, matchupOpponentMeta } from "../../shared/matchup";
import { filterPlayerStats } from "../../shared/playerStats";
import { TournamentPicker } from "../../shared/filters";

export function MPlayer() {
  const { id } = useParams();
  const { data: p, loading, error } = usePlayer(id);
  const { data: matchupsSeason } = usePlayerMatchups(id);
  const { data: index } = usePlayerIndex();
  const { data: tournaments } = useTournaments();
  const [tournamentSlug, setTournamentSlug] = useState("");
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

  if (loading) return <div className="m-page state">불러오는 중…</div>;
  if (error || !p) return <div className="m-page state">선수를 찾을 수 없습니다.</div>;
  const v = view!;

  const asBatter = (matchups ?? []).filter((m) => m.batterId === p.id);
  const asPitcher = (matchups ?? []).filter((m) => m.pitcherId === p.id);
  const bt = batsThrowsLabel(p);

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
      </div>

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="filter-bar__row filter-bar__row--tournament">
          <TournamentPicker
            value={tournamentSlug}
            onChange={setTournamentSlug}
            availableSlugs={availableSlugs}
          />
        </div>
      </div>

      {v.batting && (() => {
        // undefined 값은 "-" 로 통일 표기 (시합 필터 재집계 시 sh/sf/ibb/e 등은 측정 불가).
        const n = (x?: number) => (x == null ? "-" : String(x));
        return (
        <section className="player-section">
          <h3>타자 기록</h3>
          <div className="m-strip">
            {([
              ["타율", rate(v.batting.avg)], ["경기", n(v.batting.g)], ["타석", n(v.batting.pa)],
              ["타수", n(v.batting.ab)], ["안타", n(v.batting.h)], ["2루타", n(v.batting.b2)],
              ["3루타", n(v.batting.b3)], ["홈런", n(v.batting.hr)], ["타점", n(v.batting.rbi)],
              ["득점", n(v.batting.r)], ["도루", n(v.batting.sb)], ["볼넷", n(v.batting.bb)],
              ["고의4구", n(v.batting.ibb)], ["사구", n(v.batting.hbp)], ["삼진", n(v.batting.so)],
              ["희타", n(v.batting.sh)], ["희비", n(v.batting.sf)], ["실책", n(v.batting.e)],
              ["출루율", rate(v.batting.obp)], ["장타율", rate(v.batting.slg)],
            ] as [string, string | number][]).map(([k, val]) => (
              <div className="cell" key={k}><div className="k">{k}</div><div className="v">{val}</div></div>
            ))}
            <div className="cell"><div className="k"><SaberTerm abbr="OPS" /></div><div className="v">{rate(v.batting.obp + v.batting.slg)}</div></div>
          </div>
        </section>
        );
      })()}

      {v.pitching && (() => {
        const n = (x?: number) => (x == null ? "-" : String(x));
        return (
        <section className="player-section">
          <h3>투수 기록</h3>
          <div className="m-strip">
            {([
              ["평균자책", dec2(v.pitching.era)], ["경기", n(v.pitching.g)], ["승", n(v.pitching.w)],
              ["패", n(v.pitching.l)], ["이닝", inn(v.pitching.ip)], ["상대타자", n(v.pitching.bf)],
              ["투구수", n(v.pitching.np)], ["피안타", n(v.pitching.h)], ["피홈런", n(v.pitching.hr)],
              ["볼넷", n(v.pitching.bb)], ["탈삼진", n(v.pitching.so)], ["실점", n(v.pitching.r)],
              ["자책", n(v.pitching.er)],
            ] as [string, string | number][]).map(([k, val]) => (
              <div className="cell" key={k}><div className="k">{k}</div><div className="v">{val}</div></div>
            ))}
            <div className="cell"><div className="k"><SaberTerm abbr="WHIP" /></div><div className="v">{dec2(v.pitching.whip)}</div></div>
          </div>
        </section>
        );
      })()}

      {v.batting && (() => {
        const a = battingAdvanced(v.batting!);
        return (
          <section className="player-section">
            <h3>세이버메트릭스 (타자)</h3>
            <div className="m-strip">
              <div className="cell"><div className="k"><SaberTerm abbr="OPS" /></div><div className="v">{rate(a.ops)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="ISO" /></div><div className="v">{rate(a.iso)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="BABIP" /></div><div className="v">{rate(a.babip)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="BB%" /></div><div className="v">{pct(a.bbPct)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="K%" /></div><div className="v">{pct(a.kPct)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="BB/K" /></div><div className="v">{dec2(a.bbK)}</div></div>
            </div>
          </section>
        );
      })()}
      {v.pitching && (() => {
        const a = pitchingAdvanced(v.pitching!);
        return (
          <section className="player-section">
            <h3>세이버메트릭스 (투수)</h3>
            <div className="m-strip">
              <div className="cell"><div className="k"><SaberTerm abbr="WHIP" /></div><div className="v">{dec2(a.whip)}</div></div>
              {a.fip != null && <div className="cell"><div className="k"><SaberTerm abbr="FIP" /></div><div className="v">{dec2(a.fip)}</div></div>}
              <div className="cell"><div className="k"><SaberTerm abbr="K/9" /></div><div className="v">{dec1(a.k9)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="BB/9" /></div><div className="v">{dec1(a.bb9)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="H/9" /></div><div className="v">{dec1(a.h9)}</div></div>
              <div className="cell"><div className="k"><SaberTerm abbr="K/BB" /></div><div className="v">{dec2(a.kbb)}</div></div>
            </div>
          </section>
        );
      })()}

      <section className="player-section">
        <h3>경기 로그</h3>
        {v.gameLog.map((g, i) => (
          <div
            key={`${g.gameId}-${i}`}
            className="m-result"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}
          >
            <span className="caption">
              {formatDate(g.date)} · {g.opponent}
              {g.title && <span className="muted"> · {g.title}</span>}
            </span>
            <span>{g.line}</span>
          </div>
        ))}
      </section>

      {asPitcher.length > 0 && (
        <section className="player-section">
          <h3>상대전적 — 상대 타자</h3>
          {asPitcher.map((m) => {
            const opp = byId?.get(m.batterId);
            return (
              <div key={`${m.batterId}-${m.pitcherId}`} className="m-result">
                <span>
                  <span className="muted">vs </span>
                  <Link to={`/player/${m.batterId}`}>{m.batterName}</Link>
                  {opp && (
                    <span className="muted" style={{ marginLeft: 6 }}>
                      {matchupOpponentMeta(opp)}
                    </span>
                  )}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {rate(m.avg)} ({m.ab}-{m.h})
                </span>
              </div>
            );
          })}
        </section>
      )}

      {asBatter.length > 0 && (
        <section className="player-section">
          <h3>상대전적 — 상대 투수</h3>
          {asBatter.map((m) => {
            const opp = byId?.get(m.pitcherId);
            return (
              <div key={`${m.batterId}-${m.pitcherId}`} className="m-result">
                <span>
                  <span className="muted">vs </span>
                  <Link to={`/player/${m.pitcherId}`}>{m.pitcherName}</Link>
                  {opp && (
                    <span className="muted" style={{ marginLeft: 6 }}>
                      {matchupOpponentMeta(opp)}
                    </span>
                  )}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {rate(m.avg)} ({m.ab}-{m.h})
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
