import { Link, useParams } from "react-router-dom";
import { usePlayer, useMatchups } from "../../shared/data";
import { rate, dec2, inn, formatDate } from "../../shared/format";
import type { BattingStats, PitchingStats } from "../../shared/types";

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function BattingStrip({ b }: { b: BattingStats }) {
  return (
    <div className="stat-strip">
      <Stat k="타율" v={rate(b.avg)} />
      <Stat k="OPS" v={rate(b.obp + b.slg)} />
      <Stat k="안타" v={String(b.h)} />
      <Stat k="홈런" v={String(b.hr)} />
      <Stat k="타점" v={String(b.rbi)} />
      <Stat k="도루" v={String(b.sb)} />
    </div>
  );
}

function PitchingStrip({ p }: { p: PitchingStats }) {
  return (
    <div className="stat-strip">
      <Stat k="평균자책" v={dec2(p.era)} />
      <Stat k="WHIP" v={dec2(p.whip)} />
      <Stat k="이닝" v={inn(p.ip)} />
      <Stat k="승-패" v={`${p.w}-${p.l}`} />
      <Stat k="탈삼진" v={String(p.so)} />
    </div>
  );
}

export function PlayerPage() {
  const { id } = useParams();
  const { data: player, loading, error } = usePlayer(id);
  const { data: matchups } = useMatchups();

  if (loading) return <div className="container state">불러오는 중…</div>;
  if (error || !player)
    return <div className="container state">선수를 찾을 수 없습니다.</div>;

  const related = (matchups ?? []).filter(
    (m) => m.batterId === player.id || m.pitcherId === player.id
  );

  return (
    <div className="container page">
      <div className="player-head">
        <h1 className="heading-xl">{player.name}</h1>
        <span className="meta">
          {player.team} · {player.position}
          {player.bats && ` · ${player.bats}타`}
          {player.throws && ` ${player.throws}투`} · {player.season} 시즌
        </span>
      </div>

      {player.batting && <BattingStrip b={player.batting} />}
      {player.pitching && <PitchingStrip p={player.pitching} />}

      <h2 className="heading-md" style={{ marginTop: 24 }}>
        경기 로그
      </h2>
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

      {related.length > 0 && (
        <>
          <h2 className="heading-md" style={{ marginTop: 24 }}>
            상대전적
          </h2>
          <div className="stat-table__scroll">
            <table className="stat-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>타자</th>
                  <th style={{ textAlign: "left" }}>투수</th>
                  <th>타율</th>
                  <th>타수</th>
                  <th>안타</th>
                  <th>홈런</th>
                  <th>볼넷</th>
                  <th>삼진</th>
                </tr>
              </thead>
              <tbody>
                {related.map((m) => (
                  <tr key={`${m.batterId}-${m.pitcherId}`}>
                    <td style={{ textAlign: "left" }}>
                      <Link to={`/player/${m.batterId}`}>{m.batterName}</Link>
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <Link to={`/player/${m.pitcherId}`}>{m.pitcherName}</Link>
                    </td>
                    <td className="num">{rate(m.avg)}</td>
                    <td className="num">{m.ab}</td>
                    <td className="num">{m.h}</td>
                    <td className="num">{m.hr}</td>
                    <td className="num">{m.bb}</td>
                    <td className="num">{m.so}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
