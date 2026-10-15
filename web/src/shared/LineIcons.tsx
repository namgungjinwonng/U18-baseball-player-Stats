// 메뉴·검색·설치용 단색 아웃라인 SVG 아이콘 — 기기 글꼴과 무관하게 같은 모양으로 렌더한다.
// HomeIcon 과 같은 규칙(24 그리드, currentColor 선)을 따른다.
import type { ReactNode } from "react";

type Props = { className?: string };

function Svg({ className, children }: Props & { children: ReactNode }) {
  return (
    <svg
      className={`line-icon ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const MenuIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const SearchIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </Svg>
);

export const InstallIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
  </Svg>
);
