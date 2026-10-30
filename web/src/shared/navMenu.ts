// 메뉴 구성 — 큰 카테고리(경기·학교·선수·안내)와 항목 순서. 모바일 드로어·데스크탑 상단 메뉴·햄버거 메뉴가 함께 쓴다.
import type { IconName } from "./navIcons";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  drawerOnly?: boolean; // 데스크탑 상단 메뉴 줄에는 넣지 않고 햄버거·모바일 메뉴에만 (상단 줄 폭 여유 없음)
}

// 메인 바로가기는 데스크톱·모바일에서 같은 순서와 연결 주소를 사용한다.
export const HOME_LINKS: NavItem[] = [
  { to: "/schedule", label: "경기일정", icon: "schedule" },
  { to: "/team", label: "학교정보", icon: "team" },
  { to: "/versus", label: "매치업", icon: "versus" },
  { to: "/records", label: "선수 기록", icon: "records" },
];

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "경기", items: [{ to: "/schedule", label: "경기일정", icon: "schedule" }] },
  {
    title: "학교",
    items: [
      { to: "/team", label: "학교 정보", icon: "team" },
      { to: "/versus", label: "매치업", icon: "versus" },
      { to: "/players", label: "선수현황", icon: "players" }, // 학교 카드 → 학교별 등록 선수 명단
    ],
  },
  {
    title: "선수",
    items: [
      { to: "/search", label: "선수 검색", icon: "search" },
      { to: "/records", label: "선수 기록", icon: "records" },
      { to: "/leaders/avg", label: "랭킹", icon: "leaders" },
      { to: "/matchup", label: "상대전적", icon: "matchup" },
    ],
  },
  {
    title: "안내",
    items: [
      { to: "/glossary", label: "지표 설명", icon: "glossary" },
      { to: "/notice", label: "알리는 글", icon: "notice" },
      { to: "/fields", label: "야구장 현황", icon: "field" }, // 전국 야구장(야구부 학교·공식·프로·사회인·공원) 지역별 목록과 지도
      { to: "/ai-settings", label: "매치업 AI분석 설정", icon: "ai", drawerOnly: true }, // 사용자 API 키로 매치업 경기 분석
    ],
  },
];
