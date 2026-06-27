import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayer, usePlayerIndex, usePlayerMatchups } from "../../shared/data";
import { rate, dec2, inn, formatDate } from "../../shared/format";
import { battingAdvanced, pitchingAdvanced, pct, dec1 } from "../../shared/sabermetrics";
import { SaberTerm } from "../../shared/SaberTerm";
import { batsThrowsLabel, indexById, matchupOpponentMeta } from "../../shared/matchup";

export function MPlayer() {
  const { id } = useParams();
  const { data: p, loading, error } = usePlayer(id);
  const { data: matchups } = usePlayerMatchups(id);
  const { data: index } = usePlayerIndex();
  const byId = useMemo(() => (index ? indexById(index) : null), [index]);

  if (loading) return <div className="m-page state">불러오는 중…</div>;
  if (error || !p) return <div className="m-page state">선수를 찾을 수 없습니다.</div>;

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

      {p.batting && (
        <section className="player-section">
          <h3>타자 기록</h3>
          <div className="m-strip">
            {([
              ["타율", rate(p.batting.avg)], ["경기", p.batting.g], ["타석", p.batting.pa],
              ["타수", p.batting.ab], ["안타", p.batting.h], ["2루타", p.batting.b2],
              ["3루타", p.batting.b3], ["홈런", p.batting.hr], ["타점", p.batting.rbi],
              ["득점", p.batting.r], ["도루", p.batting.sb], ["볼넷", p.batting.bb],
              ["고의4구", p.batting.ibb ?? 0], ["사구", p.batting.hbp], ["삼진", p.batting.so],
              ["희타", p.batting.sh ?? 0], ["희비", p.batting.sf ?? 0], ["실책", p.batting.e ?? 0],
              ["출루율", rate(p.batting.obp)], ["장타율", rate(p.batting.slg)],
            ] as [string, string | number][]).map(([k, v]) => (
              <div className="cell" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
            ))}
            <div className="cell"><div className="k"><SaberTerm abbr="OPS" /></div><div className="v">{rate(p.batting.obp + p.batting.slg)}</div></div>
          </div>
        </section>
      )}

      {p.pitching && (
        <section className="player-section">
          <h3>투수 기록</h3>
          <div className="m-strip">
            {([
              ["평균자책", dec2(p.pitching.era)], ["경기", p.pitching.g], ["승", p.pitching.w],
              ["패", p.pitching.l], ["이닝", inn(p.pitching.ip)], ["상대타자", p.pitching.bf ?? 0],
              ["투구수", p.pitching.np ?? 0], ["피안타", p.pitching.h], ["피홈런", p.pitching.hr ?? 0],
              ["볼넷", p.pitching.bb], ["탈삼진", p.pitching.so], ["실점", p.pitching.r],
              ["자책", p.pitching.er],
            ] as [string, string | number][]).map(([k, v]) => (
              <div className="cell" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
            ))}
            <div className="cell"><div className="k"><SaberTerm abbr="WHIP" /></div><div className="v">{dec2(p.pitching.whip)}</div></div>
          </div>
        </section>
      )}

      {p.batting && (() => {
        const a = battingAdvanced(p.batting!);
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
      {p.pitching && (() => {
        const a = pitchingAdvanced(p.pitching!);
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
        {(p.gameLog ?? []).map((g) => (
          <div
            key={g.gameId}
            className="m-result"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}
          >
            <span className="caption">
              {formatDate(g.date)} · {g.opponent}
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
