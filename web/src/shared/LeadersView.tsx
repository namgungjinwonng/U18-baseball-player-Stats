// 항목별 전체 랭킹 페이지 본문 (데스크탑/모바일 공용).
// 상단: 타자/투수 탭 + 각 항목 칩 (선택 시 해당 항목 랭킹으로 이동).
// 필터(시합·지역·학교) 그대로 사용.
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMeta, useTournamentRecords } from "./data";
import { CATEGORIES, findCategory, rankByCategory } from "./leaders";
import { FilterBar, applyFilter, emptyFilter, type RecordFilter } from "./filters";

export function LeadersView({ wrapClass }: { wrapClass: string }) {
  const { id } = useParams();
  const nav = useNavigate();
  const cat = id ? findCategory(id) : undefined;
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const { data: players, loading } = useTournamentRecords(filter.tournament);
  const { data: meta } = useMeta();

  const ranked = useMemo(() => {
    if (!players || !cat) return [];
    const filtered = applyFilter(players, filter);
    return rankByCategory(filtered, cat, meta?.teamGames);
  }, [players, filter, meta, cat]);

  // 상단 탭: 현재 카테고리의 kind 우선, 없으면 타자.
  const activeKind: "batting" | "pitching" = cat?.kind ?? "batting";
  const battingCats = CATEGORIES.filter((c) => c.kind === "batting");
  const pitchingCats = CATEGORIES.filter((c) => c.kind === "pitching");
  const visibleCats = activeKind === "batting" ? battingCats : pitchingCats;

  return (
    <div className={wrapClass}>
      <h2 className="heading-xl" style={{ marginBottom: 8 }}>랭킹</h2>

      {/* 상단: 타자/투수 탭 + 항목 chip */}
      <div className="tabs" style={{ marginBottom: 8 }}>
        <Link
          to={`/leaders/${activeKind === "batting" ? id ?? "avg" : "avg"}`}
          className={`chip ${activeKind === "batting" ? "chip--active" : ""}`}
        >
          타자
        </Link>
        <Link
          to={`/leaders/${activeKind === "pitching" ? id ?? "era" : "era"}`}
          className={`chip ${activeKind === "pitching" ? "chip--active" : ""}`}
        >
          투수
        </Link>
      </div>
      <div className="leader-cat-grid" style={{ marginBottom: 16 }}>
        {visibleCats.map((c) => (
          <Link
            key={c.id}
            to={`/leaders/${c.id}`}
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
          <p className="caption" style={{ marginBottom: 12 }}>
            {cat.kind === "batting" ? "타자" : "투수"} · {cat.needsQualify ? "규정 미달자는 제외" : "누적값"}
            {ranked.length > 0 && ` · 총 ${ranked.length}명`}
          </p>

          <FilterBar rows={players ?? []} value={filter} onChange={setFilter} />

          {loading && <div className="state">불러오는 중…</div>}
          {!loading && ranked.length === 0 && (
            <div className="state">조건을 만족하는 선수가 없습니다.</div>
          )}

          <ol className="rank-list">
            {ranked.map((it, i) => (
              <li
                key={it.id}
                className="rank-row"
                onClick={() => nav(`/player/${it.id}`)}
                style={{ cursor: "pointer" }}
              >
                <span className="rank-num">{i + 1}</span>
                <span className="rank-name">{it.name}</span>
                <span className="rank-team">{it.team}</span>
                <span className="rank-val">{it.value}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
