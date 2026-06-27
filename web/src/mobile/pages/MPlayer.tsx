import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer, usePlayerIndex, usePlayerMatchups, useTournaments } from "../../shared/data";
import { rate, dec2, inn, formatDate } from "../../shared/format";
import { battingAdvanced, pitchingAdvanced, pct, dec1 } from "../../shared/sabermetrics";
import { SaberTerm } from "../../shared/SaberTerm";
import { batsThrowsLabel, indexById, matchupOpponentMeta } from "../../shared/matchup";
import { filterPlayerStats } from "../../shared/playerStats";

export function MPlayer() {
  const { id } = useParams();
  const { data: p, loading, error } = usePlayer(id);
  const { data: matchups } = usePlayerMatchups(id);
  const { data: index } = usePlayerIndex();
  const { data: tournaments } = useTournaments();
  const [tournament, setTournament] = useState("");
  const byId = useMemo(() => (index ? indexById(index) : null), [index]);
  const view = useMemo(() => (p ? filterPlayerStats(p, tournament) : null), [p, tournament]);
  const playerTournaments = useMemo(() => {
    if (!tournaments || !p?.gameLog) return [];
    const titles = new Set(p.gameLog.map((g) => g.title).filter(Boolean) as string[]);
    return tournaments.filter((t) => titles.has(t.title));
  }, [tournaments, p?.gameLog]);

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

      {playerTournaments.length > 0 && (
        <div className="filter-bar" style={{ marginBottom: 12 }}>
          <select
            className="m-select"
            value={tournament}
            onChange={(e) => setTournament(e.target.value)}
            aria-label="시합 선택"
          >
            <option value="">시즌 전체</option>
            {playerTournaments.map((t) => (
              <option key={t.slug} value={t.title}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {v.batting && (
        <section className="player-section">
          <h3>타자 기록</h3>
          <div className="m-strip">
            {([
              ["타율", rate(v.batting.avg)], ["경기", v.batting.g], ["타석", v.batting.pa],
              ["타수", v.batting.ab], ["안타", v.batting.h], ["2루타", v.batting.b2],
              ["3루타", v.batting.b3], ["홈런", v.batting.hr], ["타점", v.batting.rbi],
              ["득점", v.batting.r], ["도루", v.batting.sb], ["볼넷", v.batting.bb],
              ["고의4구", v.batting.ibb ?? 0], ["사구", v.batting.hbp], ["삼진", v.batting.so],
              ["희타", v.batting.sh ?? 0], ["희비", v.batting.sf ?? 0], ["실책", v.batting.e ?? 0],
              ["출루율", rate(v.batting.obp)], ["장타율", rate(v.batting.slg)],
            ] as [string, string | number][]).map(([k, val]) => (
              <div className="cell" key={k}><div className="k">{k}</div><div className="v">{val}</div></div>
            ))}
            <div className="cell"><div className="k"><SaberTerm abbr="OPS" /></div><div className="v">{rate(v.batting.obp + v.batting.slg)}</div></div>
          </div>
        </section>
      )}

      {v.pitching && (
        <section className="player-section">
          <h3>투수 기록</h3>
          <div className="m-strip">
            {([
              ["평균자책", dec2(v.pitching.era)], ["경기", v.pitching.g], ["승", v.pitching.w],
              ["패", v.pitching.l], ["이닝", inn(v.pitching.ip)], ["상대타자", v.pitching.bf ?? 0],
              ["투구수", v.pitching.np ?? 0], ["피안타", v.pitching.h], ["피홈런", v.pitching.hr ?? 0],
              ["볼넷", v.pitching.bb], ["탈삼진", v.pitching.so], ["실점", v.pitching.r],
              ["자책", v.pitching.er],
            ] as [string, string | number][]).map(([k, val]) => (
              <div className="cell" key={k}><div className="k">{k}</div><div className="v">{val}</div></div>
            ))}
            <div className="cell"><div className="k"><SaberTerm abbr="WHIP" /></div><div className="v">{dec2(v.pitching.whip)}</div></div>
          </div>
        </section>
      )}

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
