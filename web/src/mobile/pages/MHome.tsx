import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMeta, useTournamentRecords } from "../../shared/data";
import { describeQualify, leaderboards, type LeaderCategoryId } from "../../shared/leaders";
import { formatDate } from "../../shared/format";
import { Button, Chip } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, filterToQuery, useQualifyContext, type RecordFilter } from "../../shared/filters";
import { WeightToggle, useStrengthMap } from "../../shared/weights";

const BATTING_IDS: LeaderCategoryId[] = ["avg", "hr", "rbi", "h", "r", "sb"];
const ALL_LEADER_IDS: LeaderCategoryId[] = [...BATTING_IDS, "era", "whip", "so", "w", "ip"];

export function MHome() {
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const [weightOn, setWeightOn] = useState(false);
  const { data: players } = useTournamentRecords(filter.tournament);
  const { data: meta } = useMeta();
  const strengthMap = useStrengthMap(filter);
  const ctx = useQualifyContext(filter);
  // 모바일 캐러셀 = 타자 6항목 뒤 투수 5항목이 연속되는 누적 기록 TOP10.
  // 타율·평균자책 외 세이버메트릭스(출루율/OPS/wOBA/wRC+/WAR/WHIP 등)는 제외 — 랭킹 페이지에서.
  const boards = useMemo(
    () =>
      players
        ? leaderboards(applyFilter(players, filter), ctx, 10, weightOn ? strengthMap : undefined, ALL_LEADER_IDS)
        : [],
    [players, filter, ctx, weightOn, strengthMap]
  );

  // 가로 스와이프 캐러셀 — 세로 스크롤을 카드 1장 높이로 최소화, 항목은 좌우 이동.
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(Math.max(0, Math.min(i, boards.length - 1)));
  };
  const group = active < BATTING_IDS.length ? "batting" : "pitching";
  const moveToGroup = (next: "batting" | "pitching") => {
    const index = next === "batting" ? 0 : BATTING_IDS.length;
    trackRef.current?.scrollTo({ left: index * (trackRef.current?.clientWidth ?? 0) });
    setActive(index);
  };
  // 필터 변경으로 보드 구성이 바뀌면 첫 항목으로 복귀.
  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [filter.tournament, filter.region, filter.team, filter.grade]);

  return (
    <>
      <section className="m-hero">
        <div className="m-hero__inner">
          <h1 className="display-campaign">RECORDS THAT STACK UP</h1>
          <p className="m-hero__sub">
            2026 시즌부터 누적되는 고교 야구 기록. 이름으로 조회하고 상대전적까지.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/schedule">
              <Button variant="on-image" sm>
                경기일정
              </Button>
            </Link>
            <Link to="/players">
              <Button variant="secondary" sm>
                선수현황
              </Button>
            </Link>
            <Link to="/records">
              <Button variant="secondary" sm>
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
        {boards.length > 0 && (
          <>
            {/* 타자/투수 그룹 선택 — 항목은 스와이프로 이동 */}
            <div className="m-lead-chips" role="tablist" aria-label="시즌 리더 구분">
              <Chip active={group === "batting"} onClick={() => moveToGroup("batting")}>타자</Chip>
              <Chip active={group === "pitching"} onClick={() => moveToGroup("pitching")}>투수</Chip>
            </div>
            <p className="caption-sm m-lead-hint" aria-hidden>
              ← 옆으로 넘겨 다음 항목 · {active + 1}/{boards.length}
            </p>
            {/* 가로 스냅 트랙 — 카드 1장 = 한 항목 TOP10 */}
            <div className="m-lead-track" ref={trackRef} onScroll={onTrackScroll}>
              {boards.map((b) => (
                <div className="m-lead-slide" key={b.id}>
                  <div className="m-leader">
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
                      b.items.map((it, rank) => (
                        <Link to={`/player/${it.id}${filterToQuery(filter)}`} key={it.id} className="leader-row">
                          <span>
                            <span className="rank-no">{rank + 1}</span>
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
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
