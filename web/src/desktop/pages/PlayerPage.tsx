import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { usePlayer, usePlayerIndex, usePlayerMatchups } from "../../shared/data";
import { rate, dec2, inn, formatDate } from "../../shared/format";
import { battingAdvanced, pitchingAdvanced, pct, dec1 } from "../../shared/sabermetrics";
import { SaberTerm } from "../../shared/SaberTerm";
import { batsThrowsLabel, indexById, matchupOpponentMeta } from "../../shared/matchup";
import type { BattingStats, PitchingStats } from "../../shared/types";

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function SaberStat({ abbr, v }: { abbr: string; v: string }) {
  return (
    <div className="stat">
      <div className="k">
        <SaberTerm abbr={abbr} />
      </div>
      <div className="v">{v}</div>
    </div>
  );
}

function BattingStrip({ b }: { b: BattingStats }) {
  const n = (v: number | undefined) => String(v ?? 0);
  return (
    <div className="stat-strip stat-strip--compact">
      <Stat k="타율" v={rate(b.avg)} />
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
      <Stat k="출루율" v={rate(b.obp)} />
      <Stat k="장타율" v={rate(b.slg)} />
      <SaberStat abbr="OPS" v={rate(b.obp + b.slg)} />
    </div>
  );
}

function BattingSaber({ b }: { b: BattingStats }) {
  const a = battingAdvanced(b);
  return (
    <div className="stat-strip stat-strip--compact">
      <SaberStat abbr="OPS" v={rate(a.ops)} />
      <SaberStat abbr="ISO" v={rate(a.iso)} />
      <SaberStat abbr="BABIP" v={rate(a.babip)} />
      <SaberStat abbr="BB%" v={pct(a.bbPct)} />
      <SaberStat abbr="K%" v={pct(a.kPct)} />
      <SaberStat abbr="BB/K" v={dec2(a.bbK)} />
    </div>
  );
}

function PitchingSaber({ p }: { p: PitchingStats }) {
  const a = pitchingAdvanced(p);
  return (
    <div className="stat-strip stat-strip--compact">
      <SaberStat abbr="WHIP" v={dec2(a.whip)} />
      {a.fip != null && <SaberStat abbr="FIP" v={dec2(a.fip)} />}
      <SaberStat abbr="K/9" v={dec1(a.k9)} />
      <SaberStat abbr="BB/9" v={dec1(a.bb9)} />
      <SaberStat abbr="H/9" v={dec1(a.h9)} />
      <SaberStat abbr="K/BB" v={dec2(a.kbb)} />
    </div>
  );
}

function PitchingStrip({ p }: { p: PitchingStats }) {
  const n = (v: number | undefined) => String(v ?? 0);
  return (
    <div className="stat-strip stat-strip--compact">
      <Stat k="평균자책" v={dec2(p.era)} />
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
      <SaberStat abbr="WHIP" v={dec2(p.whip)} />
    </div>
  );
}

export function PlayerPage() {
  const { id } = useParams();
  const { data: player, loading, error } = usePlayer(id);
  const { data: matchups } = usePlayerMatchups(id);
  const { data: index } = usePlayerIndex();
  const byId = useMemo(() => (index ? indexById(index) : null), [index]);

  if (loading) return <div className="container state">불러오는 중…</div>;
  if (error || !player)
    return <div className="container state">선수를 찾을 수 없습니다.</div>;

  // 상대전적: 내가 타자인 경우(상대 = 투수), 내가 투수인 경우(상대 = 타자) 로 분리.
  const asBatter = (matchups ?? []).filter((m) => m.batterId === player.id);
  const asPitcher = (matchups ?? []).filter((m) => m.pitcherId === player.id);
  const bt = batsThrowsLabel(player);

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
        </div>
      </div>

      {player.batting && (
        <section className="player-section">
          <h3>타자 기록</h3>
          <BattingStrip b={player.batting} />
        </section>
      )}
      {player.pitching && (
        <section className="player-section">
          <h3>투수 기록</h3>
          <PitchingStrip p={player.pitching} />
        </section>
      )}

      {player.batting && (
        <section className="player-section">
          <h3>세이버메트릭스 (타자)</h3>
          <BattingSaber b={player.batting} />
        </section>
      )}
      {player.pitching && (
        <section className="player-section">
          <h3>세이버메트릭스 (투수)</h3>
          <PitchingSaber p={player.pitching} />
        </section>
      )}

      <section className="player-section">
        <h3>경기 로그</h3>
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
              {(player.gameLog ?? []).map((g) => (
                <tr key={g.gameId}>
                  <td style={{ textAlign: "left" }}>{formatDate(g.date)}</td>
                  <td style={{ textAlign: "left" }}>{g.opponent}</td>
                  <td style={{ textAlign: "left" }}>{g.line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {asPitcher.length > 0 && (
        <section className="player-section">
          <h3>상대전적 — 상대 타자</h3>
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>vs 타자</th>
                  <th>타율</th>
                  <th>타수</th>
                  <th>안타</th>
                  <th>홈런</th>
                  <th>볼넷</th>
                  <th>삼진</th>
                </tr>
              </thead>
              <tbody>
                {asPitcher.map((m) => {
                  const opp = byId?.get(m.batterId);
                  return (
                    <tr key={`${m.batterId}-${m.pitcherId}`}>
                      <td style={{ textAlign: "left" }}>
                        <span className="muted">vs </span>
                        <Link to={`/player/${m.batterId}`}>{m.batterName}</Link>
                        {opp && (
                          <span className="muted" style={{ marginLeft: 6 }}>
                            {matchupOpponentMeta(opp)}
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
        </section>
      )}

      {asBatter.length > 0 && (
        <section className="player-section">
          <h3>상대전적 — 상대 투수</h3>
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>vs 투수</th>
                  <th>타율</th>
                  <th>타수</th>
                  <th>안타</th>
                  <th>홈런</th>
                  <th>볼넷</th>
                  <th>삼진</th>
                </tr>
              </thead>
              <tbody>
                {asBatter.map((m) => {
                  const opp = byId?.get(m.pitcherId);
                  return (
                    <tr key={`${m.batterId}-${m.pitcherId}`}>
                      <td style={{ textAlign: "left" }}>
                        <span className="muted">vs </span>
                        <Link to={`/player/${m.pitcherId}`}>{m.pitcherName}</Link>
                        {opp && (
                          <span className="muted" style={{ marginLeft: 6 }}>
                            {matchupOpponentMeta(opp)}
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
        </section>
      )}
    </div>
  );
}
