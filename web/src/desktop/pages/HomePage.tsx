import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMeta, useTournamentRecords } from "../../shared/data";
import { describeQualify, leaderboards } from "../../shared/leaders";
import { formatDate } from "../../shared/format";
import { Button } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, filterToQuery, useQualifyContext, type RecordFilter } from "../../shared/filters";
import { WeightToggle, useStrengthMap } from "../../shared/weights";

export function HomePage() {
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const [weightOn, setWeightOn] = useState(false);
  const { data: players } = useTournamentRecords(filter.tournament);
  const { data: meta } = useMeta();
  const strengthMap = useStrengthMap(filter);
  const ctx = useQualifyContext(filter);
  const boards = useMemo(
    () =>
      players
        ? leaderboards(applyFilter(players, filter), ctx, 9, weightOn ? strengthMap : undefined)
        : [],
    [players, filter, ctx, weightOn, strengthMap]
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
        <p className="caption-sm" style={{ marginTop: -8, marginBottom: 12 }}>
          ※ {ctx.scope === "season" ? "전체 시즌" : ctx.scope === "weekend" ? "주말리그" : "전국대회"} 기준 —{" "}
          {describeQualify(ctx, "batting")} · {describeQualify(ctx, "pitching")} 충족자만 비율 순위에 노출
        </p>
        {/* players 가 잠깐 null 이어도 FilterBar 는 mount 유지(시합 cascade state 보존) */}
        <FilterBar rows={players ?? []} value={filter} onChange={setFilter} />
        {strengthMap && <WeightToggle checked={weightOn} onChange={setWeightOn} />}
        {weightOn && strengthMap && (
          <p className="caption-sm wt-note">
            비율 지표(타율·평균자책·WHIP)에 상대 가중치 적용 — 괄호 = 원값, ▲▼ = 순위 변동. 누적
            지표(홈런·타점 등)는 미적용.
          </p>
        )}
        <div className="leader-grid">
          {boards.map((b) => (
            <div className="leader-card" key={b.id}>
              <h3>
                <Link to={`/leaders/${b.id}${filterToQuery(filter)}`} className="leader-title-link">
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
                      <span className="nm">
                        {it.name}
                        {it.delta != null && it.delta !== 0 && (
                          <span className={`wt-delta ${it.delta > 0 ? "wt-delta--up" : "wt-delta--down"}`}>
                            {it.delta > 0 ? `▲${it.delta}` : `▼${-it.delta}`}
                          </span>
                        )}
                      </span>
                      <span className="tm">{it.team}</span>
                    </span>
                    <span className="val">
                      {it.value}
                      {it.origValue != null && (
                        <span className="wt-orig">({it.origValue})</span>
                      )}
                    </span>
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
