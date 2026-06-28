import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMeta, useTournamentRecords } from "../../shared/data";
import { leaderboards } from "../../shared/leaders";
import { formatDate } from "../../shared/format";
import { Button } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, type RecordFilter } from "../../shared/filters";

export function HomePage() {
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const { data: players } = useTournamentRecords(filter.tournament);
  const { data: meta } = useMeta();
  const boards = useMemo(
    () => (players ? leaderboards(applyFilter(players, filter), meta?.teamGames) : []),
    [players, filter, meta]
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
        {(() => {
          const g = filter.team ? meta?.teamGames?.[filter.team] : undefined;
          return (
            <p className="caption-sm" style={{ marginTop: -8, marginBottom: 12 }}>
              {g
                ? `※ ${filter.team} ${g}게임 반영 → 규정타석 ${Math.ceil(g * 3.1)}타석·규정이닝 ${g}이닝 이상만 타율·평균자책 순위 노출`
                : "※ 타율·평균자책 순위는 소속팀 경기수 기준 규정타석(경기수×3.1)·규정이닝(경기수×1) 충족자만 노출 (팀별 경기수 상이)"}
            </p>
          );
        })()}
        {/* players 가 잠깐 null 이어도 FilterBar 는 mount 유지(시합 cascade state 보존) */}
        <FilterBar rows={players ?? []} value={filter} onChange={setFilter} />
        <div className="leader-grid">
          {boards.map((b) => (
            <div className="leader-card" key={b.id}>
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
      </div>
    </>
  );
}
