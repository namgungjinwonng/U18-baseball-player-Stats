import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayerIndex, searchPlayers } from "../../shared/data";
import { Ico } from "../../shared/navIcons";
import { SearchIcon } from "../../shared/LineIcons";

const PAGE = 50;

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const { data: index, loading } = usePlayerIndex();

  const results = useMemo(
    () => (index ? searchPlayers(index, q) : []),
    [index, q]
  );
  // 결과가 수백 명이어도 한 번에 다 그리지 않고 PAGE명씩 늘려 보여준다.
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q]);

  return (
    <div className="container page">
      <div className="section-head">
        <h2 className="heading-xl"><Ico name="search" variant="title" />선수 검색</h2>
      </div>
      <div className="search-pill" style={{ maxWidth: 480, marginBottom: 24 }}>
        <SearchIcon />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // replace — 키 입력마다 히스토리가 쌓이면 뒤로가기가 글자 단위로만 이동
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

      {results.slice(0, limit).map((p) => (
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
      {results.length > limit && (
        <button
          className="btn btn--secondary btn--sm"
          style={{ margin: "16px auto", display: "flex" }}
          onClick={() => setLimit((n) => n + PAGE)}
        >
          더 보기 ({limit} / {results.length}명)
        </button>
      )}
    </div>
  );
}
