// 접이식 그룹 섹션(details/summary) — 선수 상세의 경기 로그(시합별)·상대전적(학교별) 공용.
import type { ReactNode } from "react";

export function Fold({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string; // 건수 등 보조 표기 (예: "4경기", "3명")
  children: ReactNode;
}) {
  return (
    <details className="fold">
      <summary className="fold__head">
        <span className="fold__title">{title}</span>
        {sub && <span className="fold__sub">{sub}</span>}
      </summary>
      <div className="fold__body">{children}</div>
    </details>
  );
}
