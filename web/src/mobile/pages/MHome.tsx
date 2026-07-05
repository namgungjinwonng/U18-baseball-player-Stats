import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMeta, useTournamentRecords } from "../../shared/data";
import { describeQualify, leaderboards } from "../../shared/leaders";
import { formatDate } from "../../shared/format";
import { Button } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, filterToQuery, useQualifyContext, type RecordFilter } from "../../shared/filters";
import { WeightToggle, useStrengthMap } from "../../shared/weights";

export function MHome() {
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
        <p className="caption-sm" style={{ marginBottom: 12 }}>
          ※ {ctx.scope === "season" ? "전체 시즌" : ctx.scope === "weekend" ? "주말리그" : "전국대회"} —{" "}
          {describeQualify(ctx, "batting")}
        </p>
        <FilterBar rows={players ?? []} value={filter} onChange={setFilter} />
        {strengthMap && <WeightToggle checked={weightOn} onChange={setWeightOn} />}
        {weightOn && strengthMap && (
          <p className="caption-sm wt-note">
            비율 지표에 상대 가중치 적용 — 괄호 = 원값, ▲▼ = 순위 변동. 누적 지표는 미적용.
          </p>
        )}
        {boards.map((b) => (
          <div className="m-leader" key={b.id}>
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
    </>
  );
}
