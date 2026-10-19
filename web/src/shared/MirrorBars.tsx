// 두 팀·두 선수 지표를 가운데 기준 좌우 대칭 막대로 비교하는 공용 컴포넌트 (대전 모드·선수 비교).
export interface MirrorRow {
  key: string;
  label: string;
  a: number | null | undefined;
  b: number | null | undefined;
  format: (v: number) => string;
  lowerIsBetter?: boolean; // ERA·WHIP처럼 낮을수록 좋은 지표
}

const better = (row: MirrorRow): "a" | "b" | null => {
  if (row.a == null || row.b == null || row.a === row.b) return null;
  const aWins = row.lowerIsBetter ? row.a < row.b : row.a > row.b;
  return aWins ? "a" : "b";
};

export function MirrorBars({ rows, aName, bName }: { rows: MirrorRow[]; aName: string; bName: string }) {
  return (
    <div className="mirror">
      <div className="mirror__names">
        <span>{aName}</span>
        <span>{bName}</span>
      </div>
      {rows.map((row) => {
        // 막대 길이는 값 크기 그대로 — 둘 중 큰 값이 반폭을 채운다. 좋은 쪽만 진하게 칠한다.
        const max = Math.max(Math.abs(row.a ?? 0), Math.abs(row.b ?? 0));
        const width = (v: number | null | undefined) => (v == null || max === 0 ? 0 : (Math.abs(v) / max) * 100);
        const win = better(row);
        return (
          <div key={row.key} className="mirror__row">
            <div className="mirror__label">
              {row.label}
              {row.lowerIsBetter && <small>낮을수록 좋음</small>}
            </div>
            <span className={`mirror__val ${win === "a" ? "is-better" : ""}`}>{row.a == null ? "-" : row.format(row.a)}</span>
            <span className="mirror__track mirror__track--a">
              <span className={`mirror__fill ${win === "a" ? "is-better" : ""}`} style={{ width: `${width(row.a)}%` }} />
            </span>
            <span className="mirror__track mirror__track--b">
              <span className={`mirror__fill ${win === "b" ? "is-better" : ""}`} style={{ width: `${width(row.b)}%` }} />
            </span>
            <span className={`mirror__val mirror__val--b ${win === "b" ? "is-better" : ""}`}>{row.b == null ? "-" : row.format(row.b)}</span>
          </div>
        );
      })}
    </div>
  );
}
