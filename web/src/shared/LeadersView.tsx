// 항목별 전체 랭킹 페이지 본문 (데스크탑/모바일 공용).
// 상단: 타자/투수/학교 탭 + 선수 랭킹 항목 선택.
// 선수 탭은 전체 필터를, 학교 탭은 시합·지역 필터만 사용.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useLeagueAverages, useSchedule, useTeams, useTournamentRecords, useTournaments } from "./data";
import { CATEGORIES, describeQualify, findCategory, rankByCategory } from "./leaders";
import {
  FilterBar, applyFilter, filterFromQuery, filterToQuery, unqualifiedToQuery, useQualifyContext,
  type RecordFilter,
} from "./filters";
import { WeightToggle, useStrengthMap } from "./weights";
import { Ico } from "./navIcons";
import { StatTable, type Column } from "./StatTable";
import { buildTeamRanking, type TeamRankingRow } from "./teamRanking";
import { categorize } from "./tournamentTree";
import { dec2, rate } from "./format";
import type { Player } from "./types";

// 이름 옆 보조 표기: (학교/학년/투타) 축약형 — 예: (유신고/3/우우). 없는 항목은 생략.
// 투타는 투(throws)·타(bats) 첫 글자만: 우투좌타 → 우좌.
function rankMeta(it: { team: string; grade?: string; bats?: string; throws?: string }): string {
  return [it.team, it.grade ?? "", `${it.throws ?? ""}${it.bats ?? ""}`]
    .filter(Boolean)
    .join("/");
}

const gamesBehind = (value: number) =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

function TeamRankingPanel({
  filter,
  setFilter,
  players,
  playersLoading,
}: {
  filter: RecordFilter;
  setFilter: (filter: RecordFilter) => void;
  players: Player[] | null;
  playersLoading: boolean;
}) {
  const nav = useNavigate();
  const schedule = useSchedule();
  const teams = useTeams();
  const tournaments = useTournaments();
  const tournament = tournaments.data?.find((item) => item.slug === filter.tournament);
  const isWeekend = !!tournament && categorize(tournament).kind === "주말리그";
  const rows = useMemo(() => {
    if (!schedule.data || !teams.data || !players) return [];
    if (filter.tournament && !tournament) return [];
    return buildTeamRanking(
      schedule.data.games,
      teams.data,
      players,
      tournament?.title,
      filter.region
    );
  }, [schedule.data, teams.data, players, tournament, filter.tournament, filter.region]);
  const columns = useMemo<Column<TeamRankingRow>[]>(() => {
    const base: Column<TeamRankingRow>[] = [
      { key: "rank", label: "순위", value: (row) => row.rank, render: (_, index) => String(index + 1), defaultDesc: false },
      {
        key: "team", label: "학교", value: (row) => row.team, defaultDesc: false, align: "left",
        // 긴 학교명은 한 단계 작은 글자로 — 열 폭이 최장 이름에 끌려가는 것을 막는다.
        render: (row) =>
          row.team.length > 3 ? <span className="cell-compact">{row.team}</span> : row.team,
      },
      { key: "region", label: "지역", value: (row) => row.region, defaultDesc: false, align: "left" },
      { key: "games", label: "경기수", value: (row) => row.games },
      { key: "w", label: "승", value: (row) => row.w },
      { key: "l", label: "패", value: (row) => row.l },
      { key: "d", label: "무", value: (row) => row.d },
      { key: "pct", label: "승률", value: (row) => row.pct, render: (row) => row.pct.toFixed(3) },
      { key: "avg", label: "팀타율", value: (row) => row.avg, render: (row) => rate(row.avg) },
      { key: "era", label: "팀평균자책점", value: (row) => row.era, render: (row) => dec2(row.era), defaultDesc: false },
    ];
    if (isWeekend) {
      base.push(
        { key: "pts", label: "승점", value: (row) => row.pts },
        { key: "gb", label: "승차", value: (row) => row.gb, render: (row) => gamesBehind(row.gb), defaultDesc: false }
      );
    }
    return base;
  }, [isWeekend]);
  const loading = playersLoading || schedule.loading || teams.loading || tournaments.loading;
  const error = schedule.error || teams.error || tournaments.error;

  return (
    <>
      <h3 className="heading-md" style={{ marginBottom: 4 }}>학교별 랭킹</h3>
      <p className="caption" style={{ marginBottom: 8 }}>
        완료 경기 기준 · 기본 정렬 경기수 내림차순
      </p>
      <FilterBar
        rows={teams.data ?? []}
        value={filter}
        onChange={setFilter}
        showGrade={false}
        showTeam={false}
      />
      {loading && <div className="state">불러오는 중…</div>}
      {!loading && error && <div className="state">데이터를 불러오지 못했습니다.</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="state">조건을 만족하는 학교가 없습니다.</div>
      )}
      {!loading && !error && rows.length > 0 && (
        <StatTable<TeamRankingRow>
          columns={columns}
          rows={rows}
          initialSort="games"
          rowKey={(row) => row.team}
          onRowClick={(row) =>
            nav(`/records${unqualifiedToQuery(filterToQuery({ ...filter, team: row.team, grade: "" }))}`)
          }
          unit="팀"
        />
      )}
    </>
  );
}

export function LeadersView({ wrapClass }: { wrapClass: string }) {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const cat = id ? findCategory(id) : undefined;
  const isTeam = id === "team";
  // 메인에서 들어올 때 URL query 에 담겨온 필터 그대로 사용.
  const [filter, setFilter] = useState<RecordFilter>(() => filterFromQuery(loc.search));
  const [includeUnqualified, setIncludeUnqualified] = useState(false);
  const [weightOn, setWeightOn] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const { data: players, loading } = useTournamentRecords(filter.tournament);
  const { data: averages } = useLeagueAverages();
  const strengthMap = useStrengthMap(filter);
  const ctx = useQualifyContext(filter);
  // wRC+/WAR 기준 리그평균: 시합 필터 시 그 시합, 아니면 시즌 전체.
  const lg = useMemo(() => {
    if (!averages) return null;
    if (filter.tournament) return averages.tournaments[filter.tournament]?.rates ?? null;
    return averages.overall;
  }, [averages, filter.tournament]);

  // 가중치 모드: 해당 카테고리가 보정 대상이고 strength 데이터가 있을 때만 실제 적용.
  const weightsActive = weightOn && !!cat?.weight && !!strengthMap;
  const ranked = useMemo(() => {
    if (!players || !cat) return [];
    const filtered = applyFilter(players, filter);
    return rankByCategory(
      filtered, cat, ctx, Infinity, includeUnqualified, lg,
      weightsActive ? strengthMap : undefined
    );
  }, [players, filter, ctx, cat, includeUnqualified, lg, weightsActive, strengthMap]);
  const qualifiedCount = useMemo(() => ranked.filter((r) => r.qualified).length, [ranked]);
  const visibleRanked = ranked.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(100);
  }, [ranked]);

  // 상단 탭: 현재 카테고리의 kind 우선, 없으면 타자.
  const activeKind: "batting" | "pitching" = cat?.kind ?? "batting";
  const battingCats = CATEGORIES.filter((c) => c.kind === "batting");
  const pitchingCats = CATEGORIES.filter((c) => c.kind === "pitching");
  const visibleCats = activeKind === "batting" ? battingCats : pitchingCats;
  const currentCatIndex = Math.max(0, visibleCats.findIndex((c) => c.id === cat?.id));
  const previousCat = visibleCats[(currentCatIndex - 1 + visibleCats.length) % visibleCats.length];
  const currentCat = visibleCats[currentCatIndex];
  const nextCat = visibleCats[(currentCatIndex + 1) % visibleCats.length];
  const shortTitle = (title: string) => title.replace(/\s*\([^)]+\)\s*/, "");

  return (
    <div className={`${wrapClass} leaders-page`}>
      <h2 className="heading-xl" style={{ marginBottom: 8 }}>
        <Ico name="leaders" variant="title" />
        랭킹
      </h2>

      {/* 상단: 타자/투수 탭 + 이전·현재·다음 항목 선택기.
          모바일에선 이 블록이 sticky 로 고정돼 아래 선수 목록만 롤로 스크롤된다.
          현재 필터(시합/지역/학교/학년)는 URL query 로 유지. */}
      <div className="leader-select">
        <div className="tabs">
          <Link
            to={`/leaders/${cat?.kind === "batting" ? id ?? "avg" : "avg"}${filterToQuery(filter)}`}
            className={`chip ${!isTeam && activeKind === "batting" ? "chip--active" : ""}`}
          >
            타자
          </Link>
          <Link
            to={`/leaders/${cat?.kind === "pitching" ? id ?? "era" : "era"}${filterToQuery(filter)}`}
            className={`chip ${!isTeam && activeKind === "pitching" ? "chip--active" : ""}`}
          >
            투수
          </Link>
          <Link
            to={`/leaders/team${filterToQuery(filter)}`}
            className={`chip ${isTeam ? "chip--active" : ""}`}
          >
            학교
          </Link>
        </div>
        {!isTeam && (
          <div className="leader-cat-picker">
            <div className="leader-cat-stepper" aria-label="랭킹 항목 이동">
              <Link
                to={`/leaders/${previousCat.id}${filterToQuery(filter)}`}
                className="leader-cat-step"
                aria-label={`이전 항목 ${shortTitle(previousCat.title)}`}
              >
                <span className="leader-cat-arrow" aria-hidden="true">‹</span>
                <span>{shortTitle(previousCat.title)}</span>
              </Link>
              <div className="leader-cat-current" aria-live="polite">
                <strong>{shortTitle(currentCat.title)}</strong>
              </div>
              <Link
                to={`/leaders/${nextCat.id}${filterToQuery(filter)}`}
                className="leader-cat-step"
                aria-label={`다음 항목 ${shortTitle(nextCat.title)}`}
              >
                <span>{shortTitle(nextCat.title)}</span>
                <span className="leader-cat-arrow" aria-hidden="true">›</span>
              </Link>
            </div>
            <button
              type="button"
              className="btn btn--secondary leader-cat-toggle"
              aria-expanded={categoryPanelOpen}
              aria-controls="leader-category-panel"
              onClick={() => setCategoryPanelOpen((open) => !open)}
            >
              {categoryPanelOpen ? "전체 항목 닫기" : "전체 항목에서 바로 선택"}
            </button>
            <div
              id="leader-category-panel"
              className="leader-cat-panel"
              hidden={!categoryPanelOpen}
            >
              {visibleCats.map((c) => (
                <Link
                  key={c.id}
                  to={`/leaders/${c.id}${filterToQuery(filter)}`}
                  className={`chip ${c.id === cat?.id ? "chip--active" : ""}`}
                  aria-current={c.id === cat?.id ? "page" : undefined}
                >
                  {shortTitle(c.title)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {isTeam ? (
        <TeamRankingPanel
          filter={filter}
          setFilter={setFilter}
          players={players}
          playersLoading={loading}
        />
      ) : !cat ? (
        <p className="state">위 항목 중 하나를 선택하세요.</p>
      ) : (
        <>
          <h3 className="heading-md" style={{ marginBottom: 4 }}>{cat.title}</h3>
          <p className="caption" style={{ marginBottom: 8 }}>
            {cat.kind === "batting" ? "타자" : "투수"}
            {cat.needsQualify
              ? ` · ${describeQualify(ctx, cat.kind)} · 규정 ${qualifiedCount}명`
              : " · 누적값"}
          </p>

          <FilterBar rows={players ?? []} value={filter} onChange={setFilter} />

          <div className="leader-options">
            {cat.needsQualify && (
              <label className="qual-toggle">
                <input
                  type="checkbox"
                  checked={includeUnqualified}
                  onChange={(e) => setIncludeUnqualified(e.target.checked)}
                />
                규정 미달 포함 (확인용)
              </label>
            )}
            {strengthMap && (
              <WeightToggle
                checked={weightOn}
                onChange={setWeightOn}
                disabled={!cat.weight}
                disabledNote="누적 지표는 가중치 미적용"
              />
            )}
          </div>
          {weightsActive && (
            <p className="caption-sm wt-note">
              보정값 기준 순위 · 괄호 안 = 원값, ▲▼ = 원 순위 대비 변동
            </p>
          )}

          {loading && <div className="state">불러오는 중…</div>}
          {!loading && ranked.length === 0 && (
            <div className="state">조건을 만족하는 선수가 없습니다.</div>
          )}

          <ol className="rank-list">
            {(() => {
              let rank = 0; // 규정 충족자만 순번 부여
              return visibleRanked.map((it) => {
                if (it.qualified) rank += 1;
                const r = rank;
                return (
                  <li
                    key={it.id}
                    className={`rank-row ${it.qualified ? "" : "rank-row--unqual"}`}
                    onClick={() => nav(`/player/${it.id}${filterToQuery(filter)}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <span className="rank-num">{it.qualified ? r : "–"}</span>
                    <span className="rank-name">
                      {it.name}
                      <span className="rank-meta">({rankMeta(it)})</span>
                      {!it.qualified && <span className="qual-badge">규정 미달</span>}
                      {it.delta != null && it.delta !== 0 && (
                        <span className={`wt-delta ${it.delta > 0 ? "wt-delta--up" : "wt-delta--down"}`}>
                          {it.delta > 0 ? `▲${it.delta}` : `▼${-it.delta}`}
                        </span>
                      )}
                    </span>
                    <span className="rank-val">
                      {it.value}
                      {it.origValue != null && (
                        <span className="wt-orig">({it.origValue})</span>
                      )}
                    </span>
                  </li>
                );
              });
            })()}
            {ranked.length > visibleRanked.length && (
              <li className="rank-list-more">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setVisibleCount((count) => Math.min(count + 100, ranked.length))}
                >
                  전체 {ranked.length}명 보기 (현재 상위 {visibleRanked.length}명)
                </button>
              </li>
            )}
          </ol>
        </>
      )}
    </div>
  );
}
