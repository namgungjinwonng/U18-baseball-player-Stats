import { Link, useParams } from "react-router-dom";
import { usePlayer, useMatchups } from "../../shared/data";
import { rate, dec2, inn, formatDate } from "../../shared/format";

export function MPlayer() {
  const { id } = useParams();
  const { data: p, loading, error } = usePlayer(id);
  const { data: matchups } = useMatchups();

  if (loading) return <div className="m-page state">불러오는 중…</div>;
  if (error || !p) return <div className="m-page state">선수를 찾을 수 없습니다.</div>;

  const related = (matchups ?? []).filter(
    (m) => m.batterId === p.id || m.pitcherId === p.id
  );

  return (
    <div className="m-page">
      <h2 className="heading-xl" style={{ marginBottom: 4 }}>
        {p.name}
      </h2>
      <p className="caption" style={{ marginBottom: 16 }}>
        {p.team} · {p.position} · {p.season} 시즌
      </p>

      {p.batting && (
        <div className="m-strip">
          <div className="cell">
            <div className="k">타율</div>
            <div className="v">{rate(p.batting.avg)}</div>
          </div>
          <div className="cell">
            <div className="k">OPS</div>
            <div className="v">{rate(p.batting.obp + p.batting.slg)}</div>
          </div>
          <div className="cell">
            <div className="k">안타</div>
            <div className="v">{p.batting.h}</div>
          </div>
          <div className="cell">
            <div className="k">홈런</div>
            <div className="v">{p.batting.hr}</div>
          </div>
          <div className="cell">
            <div className="k">타점</div>
            <div className="v">{p.batting.rbi}</div>
          </div>
          <div className="cell">
            <div className="k">도루</div>
            <div className="v">{p.batting.sb}</div>
          </div>
        </div>
      )}

      {p.pitching && (
        <div className="m-strip">
          <div className="cell">
            <div className="k">평균자책</div>
            <div className="v">{dec2(p.pitching.era)}</div>
          </div>
          <div className="cell">
            <div className="k">WHIP</div>
            <div className="v">{dec2(p.pitching.whip)}</div>
          </div>
          <div className="cell">
            <div className="k">이닝</div>
            <div className="v">{inn(p.pitching.ip)}</div>
          </div>
          <div className="cell">
            <div className="k">승-패</div>
            <div className="v">
              {p.pitching.w}-{p.pitching.l}
            </div>
          </div>
          <div className="cell">
            <div className="k">탈삼진</div>
            <div className="v">{p.pitching.so}</div>
          </div>
          <div className="cell">
            <div className="k">세이브</div>
            <div className="v">{p.pitching.sv}</div>
          </div>
        </div>
      )}

      <h3 className="heading-md">경기 로그</h3>
      {p.gameLog.map((g) => (
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

      {related.length > 0 && (
        <>
          <h3 className="heading-md" style={{ marginTop: 24 }}>
            상대전적
          </h3>
          {related.map((m) => (
            <div key={`${m.batterId}-${m.pitcherId}`} className="m-result">
              <span>
                <Link to={`/player/${m.batterId}`}>{m.batterName}</Link>
                <span className="muted"> vs </span>
                <Link to={`/player/${m.pitcherId}`}>{m.pitcherName}</Link>
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {rate(m.avg)} ({m.ab}-{m.h})
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
