import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayerIndex, searchPlayers } from "../../shared/data";

export function MSearch() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const { data: index, loading } = usePlayerIndex();
  const results = useMemo(
    () => (index ? searchPlayers(index, q) : []),
    [index, q]
  );

  return (
    <div className="m-page">
      <h2 className="heading-xl">선수 검색</h2>
      <div className="search-pill" style={{ marginBottom: 16 }}>
        <span aria-hidden>⌕</span>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setParams(e.target.value ? { q: e.target.value } : {});
          }}
          placeholder="선수 이름 또는 팀"
          aria-label="선수 검색"
        />
      </div>
      {loading && <div className="state">불러오는 중…</div>}
      {!loading && q && results.length === 0 && (
        <div className="state">‘{q}’ 검색 결과가 없습니다.</div>
      )}
      {!q && <div className="state muted">이름을 입력하세요.</div>}
      {results.map((p) => (
        <Link to={`/player/${p.id}`} key={p.id} className="m-result">
          <span>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span className="tm" style={{ color: "var(--color-mute)", marginLeft: 8 }}>
              {p.team}
            </span>
          </span>
          <span className="pos">{p.position}</span>
        </Link>
      ))}
    </div>
  );
}
