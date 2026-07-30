// 메뉴/페이지 타이틀용 아이콘 8종 — 항목별로 한 파일을 모든 위치에서 공용한다.
// 드로어에서는 .nav-ico, 페이지 제목 옆에서는 .title-ico 크기로 렌더한다.
import calendarPng from "../assets/icons/calendar.png";
import profilePng from "../assets/icons/profile.png";
import jerseySvg from "../assets/icons/jersey.svg";
import trophySvg from "../assets/icons/trophy.svg";
import sportsPng from "../assets/icons/sports.png";
import searchPng from "../assets/icons/search.png";
import chartPng from "../assets/icons/chart.png";
import announcementPng from "../assets/icons/announcement.png";

// 메뉴명 → 아이콘 파일 (드로어·페이지 제목 공용)
const SRC = {
  schedule: calendarPng, // 경기일정 — 기존 달력
  players: profilePng, // 선수현황 — 기존 선수
  records: jerseySvg, // 선수 기록 상세·선수 기록 — 등번호 유니폼
  leaders: trophySvg, // 항목별 랭킹 — C7 트로피
  matchup: sportsPng, // 상대전적 — 기존 교차 배트
  search: searchPng, // 선수 검색 — 기존 검색
  glossary: chartPng, // 지표 설명 — 기존 차트
  notice: announcementPng, // 알리는 글 — 기존 알림
} as const;

// 드로어 첫 클릭 전에 아이콘 요청과 디코딩을 끝내도록 이미지 객체를 모듈 수명 동안 유지한다.
const preloadedNavImages = new Set<HTMLImageElement>();
let preloadStarted = false;

export function preloadNavIcons() {
  if (preloadStarted || typeof Image === "undefined") return;
  preloadStarted = true;

  for (const src of Object.values(SRC)) {
    const image = new Image();
    image.decoding = "async";
    preloadedNavImages.add(image);
    image.src = src;
    void image.decode().catch(() => {}).finally(() => preloadedNavImages.delete(image));
  }
}

export type IconName = keyof typeof SRC;

// variant: "nav" = 드로어 항목, "title" = 페이지 제목 옆(글자 높이에 맞춤)
export function Ico({ name, variant = "nav" }: { name: IconName; variant?: "nav" | "title" }) {
  return (
    <img
      className={variant === "title" ? "title-ico" : "nav-ico"}
      src={SRC[name]}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
