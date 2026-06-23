import { Link } from "react-router-dom";
import { useAllPlayers, useMeta } from "../../shared/data";
import { leaderboards } from "../../shared/leaders";
import { formatDate } from "../../shared/format";
import { Button } from "../../design/ui";

export function MHome() {
  const { data: players } = useAllPlayers();
  const { data: meta } = useMeta();
  const boards = players ? leaderboards(players) : [];

  return (
    <>
      <section className="m-hero">
        <h1 className="display-campaign">RECORDS THAT STACK UP</h1>
        <p className="m-hero__sub">
          2026 시즌부터 누적되는 고교 야구 기록. 이름으로 조회하고 상대전적까지.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/records">
            <Button variant="on-image" sm>
              선수 기록
            </Button>
          </Link>
          <Link to="/matchup">
            <Button variant="secondary" sm>
              상대전적
            </Button>
          </Link>
        </div>
      </section>

      <div className="m-page">
        <h2 className="heading-xl">시즌 리더</h2>
        {meta && (
          <p className="caption" style={{ marginTop: -8, marginBottom: 16 }}>
            {meta.gameCount}경기 · 갱신 {formatDate(meta.lastUpdated)}
          </p>
        )}
        {boards.map((b) => (
          <div className="m-leader" key={b.title}>
            <h3>{b.title}</h3>
            {b.items.slice(0, 3).map((it) => (
              <Link to={`/player/${it.id}`} key={it.id} className="leader-row">
                <span>
                  <span className="nm">{it.name}</span>
                  <span className="tm">{it.team}</span>
                </span>
                <span className="val">{it.value}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
