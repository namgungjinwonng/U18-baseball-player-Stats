import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayerIndex, searchPlayers } from "../../shared/data";
import { Ico } from "../../shared/navIcons";

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const { data: index, loading } = usePlayerIndex();

  const results = useMemo(
    () => (index ? searchPlayers(index, q) : []),
    [index, q]
  );

  return (
    <div className="container page">
      <div className="section-head">
        <h2 className="heading-xl"><Ico name="search" variant="title" />선수 검색</h2>
      </div>
      <div className="search-pill" style={{ maxWidth: 480, marginBottom: 24 }}>
        <span aria-hidden>⌕</span>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setParams(e.target.value ? { q: e.target.value } : {});
          }}
          placeholder="선수 검색 (이름 또는 팀+등번호 가능)"
          aria-label="선수 검색 — 이름 또는 팀+등번호"
        />
      </div>

      {loading && <div className="state">불러오는 중…</div>}
      {!loading && q && results.length === 0 && (
        <div className="state">‘{q}’ 검색 결과가 없습니다.</div>
      )}
      {!q && <div className="state muted">이름을 입력해 선수를 찾아보세요.</div>}

      {results.map((p) => (
        <Link to={`/player/${p.id}`} key={p.id} className="result-row">
          <span>
            <span className="nm" style={{ fontWeight: 500 }}>
              {p.name}
            </span>
            <span className="tm" style={{ color: "var(--color-mute)", marginLeft: 8 }}>
              {p.team}
              {p.grade && ` · ${p.grade}학년`}
              {p.number && ` · ${p.number}번`}
            </span>
          </span>
          <span className="pos">{p.position}</span>
        </Link>
      ))}
    </div>
  );
}
