import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayerIndex, searchPlayers } from "../../shared/data";
import { Ico } from "../../shared/navIcons";

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
      <h2 className="heading-xl"><Ico name="search" variant="title" />선수 검색</h2>
      <div className="search-pill" style={{ marginBottom: 16 }}>
        <span aria-hidden>⌕</span>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // replace — 키 입력마다 히스토리가 쌓이면 뒤로가기가 글자 단위로만 이동(모바일 뒤로가기 무반응 원인)
            setParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
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
        <Link to={`/player/${p.id}`} key={p.id} className="m-result">
          <span>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
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
