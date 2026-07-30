// 홈 이동을 나타내는 야구 홈베이스(오각형) 아이콘 — 브랜드 로고(U18 BASEBALL) 옆에 부착.
// 앱의 다른 아이콘(⌕ ☰ ✕)처럼 currentColor 를 따르는 단색 아웃라인.
export function HomeIcon() {
  return (
    <svg
      className="home-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.5 4.5h13a.5.5 0 0 1 .5.5v7.2c0 .35-.12.64-.35.9l-6 6.55a.88.88 0 0 1-1.3 0l-6-6.55a1.32 1.32 0 0 1-.35-.9V5a.5.5 0 0 1 .5-.5Z" />
    </svg>
  );
}
