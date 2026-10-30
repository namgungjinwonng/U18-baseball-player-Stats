import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePlayerSearchIndex, searchPlayers } from "../../shared/data";
import { playerSearchLink } from "../../shared/playerSearch";
import { Ico } from "../../shared/navIcons";
import { SearchIcon } from "../../shared/LineIcons";

const PAGE = 50;

export function MSearch() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const { data: index, loading } = usePlayerSearchIndex();
  const results = useMemo(
    () => (index ? searchPlayers(index, q) : []),
    [index, q]
  );
  // 결과가 수백 명이어도 한 번에 다 그리지 않고 PAGE명씩 늘려 보여준다.
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q]);

  return (
    <div className="m-page">
      <h2 className="heading-xl"><Ico name="search" variant="title" />선수 검색</h2>
      <div className="search-pill" style={{ marginBottom: 16 }}>
        <SearchIcon />
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
      {results.slice(0, limit).map((p) => (
        <Link to={playerSearchLink(p)} key={p.id} className="m-result">
          <span>
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            <span className="tm" style={{ color: "var(--color-mute)", marginLeft: 8 }}>
              {p.team}
              {p.grade && ` · ${p.grade}학년`}
              {p.number && ` · ${p.number}번`}
              {p.recordless && " · 기록 없음"}
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
