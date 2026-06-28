import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMeta, useTournamentRecords } from "../../shared/data";
import { leaderboards } from "../../shared/leaders";
import { formatDate } from "../../shared/format";
import { Button } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, type RecordFilter } from "../../shared/filters";

export function MHome() {
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const { data: players } = useTournamentRecords(filter.tournament);
  const { data: meta } = useMeta();
  const boards = useMemo(
    () => (players ? leaderboards(applyFilter(players, filter), meta?.teamGames) : []),
    [players, filter, meta]
  );

  return (
    <>
      <section className="m-hero">
        <div className="m-hero__inner">
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
        </div>
      </section>

      <div className="m-page">
        <h2 className="heading-xl">시즌 리더</h2>
        {meta && (
          <p className="caption" style={{ marginTop: -8, marginBottom: 16 }}>
            {meta.gameCount}경기 · 갱신 {formatDate(meta.lastUpdated)}
          </p>
        )}
        {(() => {
          const g = filter.team ? meta?.teamGames?.[filter.team] : undefined;
          return (
            <p className="caption-sm" style={{ marginBottom: 12 }}>
              {g
                ? `※ ${filter.team} ${g}게임 반영 → 규정타석 ${Math.ceil(g * 3.1)}·규정이닝 ${g} 이상만 노출`
                : "※ 타율·평균자책은 소속팀 경기수 기준 규정타석·규정이닝 충족자만 노출"}
            </p>
          );
        })()}
        {players && <FilterBar rows={players} value={filter} onChange={setFilter} />}
        {boards.map((b) => (
          <div className="m-leader" key={b.id}>
            <h3>
              <Link to={`/leaders/${b.id}`} className="leader-title-link">
                {b.title} <span aria-hidden>›</span>
              </Link>
            </h3>
            {b.items.length === 0 ? (
              <div className="leader-row muted" style={{ fontSize: 12 }}>
                조건을 만족하는 선수가 없습니다.
              </div>
            ) : (
              b.items.map((it) => (
                <Link to={`/player/${it.id}`} key={it.id} className="leader-row">
                  <span>
                    <span className="nm">{it.name}</span>
                    <span className="tm">{it.team}</span>
                  </span>
                  <span className="val">{it.value}</span>
                </Link>
              ))
            )}
          </div>
        ))}
      </div>
    </>
  );
}
