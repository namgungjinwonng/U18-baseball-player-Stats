import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAllPlayers, useMeta } from "../../shared/data";
import { leaderboards } from "../../shared/leaders";
import { formatDate } from "../../shared/format";
import { Button } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, type RecordFilter } from "../../shared/filters";

export function HomePage() {
  const { data: players } = useAllPlayers();
  const { data: meta } = useMeta();
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const boards = useMemo(
    () => (players ? leaderboards(applyFilter(players, filter)) : []),
    [players, filter]
  );

  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="hero__sub" style={{ marginTop: 0 }}>
            2026 시즌부터 누적되는 고교 야구 기록
          </p>
          <h1 className="display-campaign">RECORDS THAT STACK UP</h1>
          <p className="hero__sub">
            선수 이름으로 타격·투구 기록을 조회하고, 타자 vs 투수 상대전적까지 한눈에.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/records">
              <Button variant="on-image">선수 기록 보기</Button>
            </Link>
            <Link to="/matchup">
              <Button variant="secondary">상대전적</Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="container page">
        <div className="section-head">
          <h2 className="heading-xl">시즌 리더</h2>
          {meta && (
            <span className="caption">
              {meta.gameCount}경기 · 갱신 {formatDate(meta.lastUpdated)}
            </span>
          )}
        </div>
        {players && <FilterBar rows={players} value={filter} onChange={setFilter} />}
        <div className="leader-grid">
          {boards.map((b) => (
            <div className="leader-card" key={b.title}>
              <h3>{b.title}</h3>
              {b.items.map((it) => (
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
      </div>
    </>
  );
}
