// 정렬 가능한 기록 테이블 — 데스크탑/모바일 공용 (프레젠테이션 전용).
// 다중 정렬: 최대 3개 키. 헤더 클릭 1회=내림, 2회=오름, 3회=해제.
// 우선순위는 추가된 순서 (먼저 추가한 키가 1순위).
import { useEffect, useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  // 정렬/표시에 쓸 원시 값
  value: (row: T) => number | string;
  // 표시 문자열 (생략 시 value 사용)
  render?: (row: T) => string;
  // 기본 정렬 방향 (숫자 기록은 대개 내림차순)
  defaultDesc?: boolean;
}

interface SortKey {
  key: string;
  desc: boolean;
}

const MAX_KEYS = 3;

export function StatTable<T>({
  columns,
  rows,
  initialSort,
  onRowClick,
  rowKey,
  limit = 100,
}: {
  columns: Column<T>[];
  rows: T[];
  initialSort?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  // 순위 테이블이므로 정렬 후 상위 N명만 렌더(대량 행 성능 보호).
  limit?: number;
}) {
  const initialKey = initialSort ?? columns[0]?.key;
  const initialDesc = columns.find((c) => c.key === initialKey)?.defaultDesc ?? true;
  const [sortKeys, setSortKeys] = useState<SortKey[]>(
    initialKey ? [{ key: initialKey, desc: initialDesc }] : []
  );
  const [visibleCount, setVisibleCount] = useState(limit);

  useEffect(() => {
    setVisibleCount(limit);
  }, [rows, limit]);

  const sorted = useMemo(() => {
    if (sortKeys.length === 0) return rows;
    const cols = sortKeys
      .map((s) => ({ s, col: columns.find((c) => c.key === s.key) }))
      .filter((x) => x.col);
    if (cols.length === 0) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      for (const { s, col } of cols) {
        const av = col!.value(a);
        const bv = col!.value(b);
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv;
        } else {
          cmp = String(av).localeCompare(String(bv), "ko");
        }
        if (cmp !== 0) return s.desc ? -cmp : cmp;
      }
      return 0;
    });
    return copy;
  }, [rows, columns, sortKeys]);

  function clickHeader(col: Column<T>) {
    setVisibleCount(limit);
    setSortKeys((prev) => {
      const idx = prev.findIndex((s) => s.key === col.key);
      if (idx === -1) {
        // 신규 → 추가 (가장 최근 추가가 우선순위 마지막). 최대 3개.
        const next: SortKey[] = [...prev, { key: col.key, desc: col.defaultDesc ?? true }];
        return next.slice(-MAX_KEYS);
      }
      const cur = prev[idx];
      if (cur.desc) {
        // 내림 → 오름
        const next = [...prev];
        next[idx] = { ...cur, desc: false };
        return next;
      }
      // 오름 → 해제
      return prev.filter((_, i) => i !== idx);
    });
  }

  const capped = sorted.slice(0, visibleCount);

  return (
    <div className="stat-table__scroll">
      <table className="stat-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const idx = sortKeys.findIndex((s) => s.key === col.key);
              const cur = idx >= 0 ? sortKeys[idx] : null;
              return (
                <th key={col.key} onClick={() => clickHeader(col)}>
                  {col.label}
                  {cur && (
                    <span className="sort-mark">
                      {cur.desc ? " ▾" : " ▴"}
                      {sortKeys.length > 1 && <sup>{idx + 1}</sup>}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {capped.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              {columns.map((col) => (
                <td key={col.key} className="num">
                  {col.render ? col.render(row) : String(col.value(row))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sortKeys.length > 1 && (
        <p className="caption" style={{ marginTop: 8 }}>
          정렬 우선순위: {sortKeys.map((s, i) =>
            `${i + 1}. ${columns.find((c) => c.key === s.key)?.label ?? s.key} ${s.desc ? "↓" : "↑"}`
          ).join("  ·  ")}
          {" · "}
          <button
            type="button"
            className="link-btn"
            onClick={(e) => { e.stopPropagation(); setSortKeys([]); }}
          >
            전체 해제
          </button>
        </p>
      )}
      {sorted.length > capped.length && (
        <button
          className="btn btn--secondary btn--sm"
          style={{ margin: "16px auto", display: "flex" }}
          onClick={() => setVisibleCount((count) => Math.min(count + limit, sorted.length))}
        >
          전체 {sorted.length}명 보기 (현재 상위 {capped.length}명)
        </button>
      )}
    </div>
  );
}
