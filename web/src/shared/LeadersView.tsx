// 항목별 전체 랭킹 페이지 본문 (데스크탑/모바일 공용).
// 상단: 타자/투수 탭 + 각 항목 칩 (선택 시 해당 항목 랭킹으로 이동).
// 필터(시합·지역·학교·학년) 그대로 사용.
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useLeagueAverages, useTournamentRecords } from "./data";
import { CATEGORIES, describeQualify, findCategory, rankByCategory } from "./leaders";
import {
  FilterBar, applyFilter, filterFromQuery, filterToQuery, useQualifyContext, type RecordFilter,
} from "./filters";
import { WeightToggle, useStrengthMap } from "./weights";
import { Ico } from "./navIcons";

// 이름 옆 보조 표기: (학교/학년/투타) 축약형 — 예: (유신고/3/우우). 없는 항목은 생략.
// 투타는 투(throws)·타(bats) 첫 글자만: 우투좌타 → 우좌.
function rankMeta(it: { team: string; grade?: string; bats?: string; throws?: string }): string {
  return [it.team, it.grade ?? "", `${it.throws ?? ""}${it.bats ?? ""}`]
    .filter(Boolean)
    .join("/");
}

export function LeadersView({ wrapClass }: { wrapClass: string }) {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const cat = id ? findCategory(id) : undefined;
  // 메인에서 들어올 때 URL query 에 담겨온 필터 그대로 사용.
  const [filter, setFilter] = useState<RecordFilter>(() => filterFromQuery(loc.search));
  const [includeUnqualified, setIncludeUnqualified] = useState(false);
  const [weightOn, setWeightOn] = useState(false);
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

  // 상단 탭: 현재 카테고리의 kind 우선, 없으면 타자.
  const activeKind: "batting" | "pitching" = cat?.kind ?? "batting";
  const battingCats = CATEGORIES.filter((c) => c.kind === "batting");
  const pitchingCats = CATEGORIES.filter((c) => c.kind === "pitching");
  const visibleCats = activeKind === "batting" ? battingCats : pitchingCats;

  return (
    <div className={wrapClass}>
      <h2 className="heading-xl" style={{ marginBottom: 8 }}>
        <Ico name="leaders" variant="title" />
        랭킹
      </h2>

      {/* 상단: 타자/투수 탭 + 항목 chip. 현재 필터(시합/지역/학교/학년)는 URL query 로 유지. */}
      <div className="tabs" style={{ marginBottom: 8 }}>
        <Link
          to={`/leaders/${activeKind === "batting" ? id ?? "avg" : "avg"}${filterToQuery(filter)}`}
          className={`chip ${activeKind === "batting" ? "chip--active" : ""}`}
        >
          타자
        </Link>
        <Link
          to={`/leaders/${activeKind === "pitching" ? id ?? "era" : "era"}${filterToQuery(filter)}`}
          className={`chip ${activeKind === "pitching" ? "chip--active" : ""}`}
        >
          투수
        </Link>
      </div>
      <div className="leader-cat-grid" style={{ marginBottom: 16 }}>
        {visibleCats.map((c) => (
          <Link
            key={c.id}
            to={`/leaders/${c.id}${filterToQuery(filter)}`}
            className={`chip ${c.id === cat?.id ? "chip--active" : ""}`}
          >
            {c.title.replace(/\s*\([^)]+\)\s*/, "")}
          </Link>
        ))}
      </div>

      {!cat ? (
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
              return ranked.map((it) => {
                if (it.qualified) rank += 1;
                const r = rank;
                return (
                  <li
                    key={it.id}
                    className={`rank-row ${it.qualified ? "" : "rank-row--unqual"}`}
                    onClick={() => nav(`/player/${it.id}`)}
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
          </ol>
        </>
      )}
    </div>
  );
}
