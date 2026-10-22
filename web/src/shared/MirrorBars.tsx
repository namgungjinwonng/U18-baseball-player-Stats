// 두 팀·두 선수 지표를 가운데 기준 좌우 대칭 막대로 비교하는 공용 컴포넌트 (대전 모드·선수 비교).
// 우위는 파스텔 레드, 열위는 파스텔 블루로 차이 크기에 따라 3단계 농도를 적용하고 대등은 옅은 회색으로 표시한다.
// 우위 단계 글자는 우위 학교 쪽 막대 위에 텍스트로만 표시한다.
import { EDGE_LABELS, compareEdge } from "./heat";

export interface MirrorRow {
  key: string;
  label: string;
  a: number | null | undefined;
  b: number | null | undefined;
  format: (v: number) => string;
  lowerIsBetter?: boolean; // ERA·WHIP처럼 낮을수록 좋은 지표
}

const compare = (row: MirrorRow) => compareEdge(row.a, row.b, row.lowerIsBetter);

// 각 쪽이 앞선 항목 수 (대등·값 없음 제외)
export function countWins(rows: MirrorRow[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const row of rows) {
    const { win } = compare(row);
    if (win === "a") a += 1;
    else if (win === "b") b += 1;
  }
  return { a, b };
}

export function MirrorBars({ rows, aName, bName }: { rows: MirrorRow[]; aName: string; bName: string }) {
  const wins = countWins(rows);
  return (
    <div className="mirror">
      <div className="mirror__names">
        <span>{aName} <small className={wins.a > wins.b ? "is-lead" : ""}>({wins.a}개 항목 우위)</small></span>
        <span><small className={wins.b > wins.a ? "is-lead" : ""}>({wins.b}개 항목 우위)</small> {bName}</span>
      </div>
      {rows.map((row) => {
        // 막대 길이는 값 크기 그대로 — 둘 중 큰 값이 반폭을 채운다.
        const max = Math.max(Math.abs(row.a ?? 0), Math.abs(row.b ?? 0));
        const width = (v: number | null | undefined) => (v == null || max === 0 ? 0 : (Math.abs(v) / max) * 100);
        const { win, level } = compare(row);
        const tone = (side: "a" | "b") => (win == null ? "even" : win === side ? `win${level}` : `lose${level}`);
        const edge = (side: "a" | "b") =>
          win === side ? <span className={`mirror__edge mirror__edge--${side} mirror__edge--l${level}`}>{EDGE_LABELS[level]}</span> : null;
        return (
          <div key={row.key} className="mirror__row">
            <div className="mirror__head">
              {edge("a")}
              <span className="mirror__label">
                {row.label}
                {row.lowerIsBetter && <small>낮을수록 좋음</small>}
                {win == null && row.a != null && row.b != null && <span className="mirror__even">대등</span>}
              </span>
              {edge("b")}
            </div>
            <span className={`mirror__val ${win === "a" ? "is-better" : ""}`}>{row.a == null ? "-" : row.format(row.a)}</span>
            <span className="mirror__track mirror__track--a">
              <span className={`mirror__fill mirror__fill--${tone("a")}`} style={{ width: `${width(row.a)}%` }} />
            </span>
            <span className="mirror__track mirror__track--b">
              <span className={`mirror__fill mirror__fill--${tone("b")}`} style={{ width: `${width(row.b)}%` }} />
            </span>
            <span className={`mirror__val mirror__val--b ${win === "b" ? "is-better" : ""}`}>{row.b == null ? "-" : row.format(row.b)}</span>
          </div>
        );
      })}
      <p className="mirror__legend">
        <span className="mirror__sw mirror__fill--win1" />근소 우위(차이 10% 미만)
        <span className="mirror__sw mirror__fill--win2" />우위(25% 미만)
        <span className="mirror__sw mirror__fill--win3" />큰 우위
        <span className="mirror__sw mirror__fill--lose" />열위
        <span className="mirror__sw mirror__fill--even" />대등(3% 미만)
      </p>
    </div>
  );
}
