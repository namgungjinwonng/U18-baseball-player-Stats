// 정렬 가능한 기록 테이블 — 데스크탑/모바일 공용 (프레젠테이션 전용).
import { useMemo, useState } from "react";

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

export function StatTable<T>({
  columns,
  rows,
  initialSort,
  onRowClick,
  rowKey,
  limit = 200,
}: {
  columns: Column<T>[];
  rows: T[];
  initialSort?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  // 순위 테이블이므로 정렬 후 상위 N명만 렌더(대량 행 성능 보호).
  limit?: number;
}) {
  const [sortKey, setSortKey] = useState(initialSort ?? columns[0].key);
  const [desc, setDesc] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (typeof av === "number" && typeof bv === "number") {
        return desc ? bv - av : av - bv;
      }
      return desc
        ? String(bv).localeCompare(String(av), "ko")
        : String(av).localeCompare(String(bv), "ko");
    });
    return copy;
  }, [rows, columns, sortKey, desc]);

  function clickHeader(col: Column<T>) {
    if (col.key === sortKey) {
      setDesc((d) => !d);
    } else {
      setSortKey(col.key);
      setDesc(col.defaultDesc ?? true);
    }
  }

  const capped = showAll ? sorted : sorted.slice(0, limit);

  return (
    <div className="stat-table__scroll">
      <table className="stat-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} onClick={() => clickHeader(col)}>
                {col.label}
                {col.key === sortKey ? (desc ? " ▾" : " ▴") : ""}
              </th>
            ))}
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
      {!showAll && sorted.length > limit && (
        <button className="btn btn--secondary btn--sm" style={{ margin: "16px auto", display: "flex" }} onClick={() => setShowAll(true)}>
          전체 {sorted.length}명 보기 (현재 상위 {limit}명)
        </button>
      )}
    </div>
  );
}
