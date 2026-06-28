// 항목별 전체 랭킹 페이지 본문 (데스크탑/모바일 공용).
// 필터(시합·지역·학교) 그대로 사용. 미지정 카테고리 ID 면 홈으로 안내.
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

  if (!cat) {
    return (
      <div className={wrapClass}>
        <h2 className="heading-xl">랭킹</h2>
        <p className="state">알 수 없는 항목입니다.</p>
        <div className="leader-cat-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/leaders/${c.id}`} className="chip">
              {c.title}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <h2 className="heading-xl" style={{ marginBottom: 4 }}>{cat.title} 랭킹</h2>
      <p className="caption" style={{ marginBottom: 12 }}>
        {cat.kind === "batting" ? "타자" : "투수"} · {cat.needsQualify ? "규정 미달자는 제외" : "누적값"}
        {ranked.length > 0 && ` · 총 ${ranked.length}명`}
      </p>

      {players && <FilterBar rows={players} value={filter} onChange={setFilter} />}

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

      <h3 className="heading-md" style={{ marginTop: 32 }}>다른 항목</h3>
      <div className="leader-cat-grid">
        {CATEGORIES.filter((c) => c.id !== cat.id).map((c) => (
          <Link key={c.id} to={`/leaders/${c.id}`} className="chip">
            {c.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
