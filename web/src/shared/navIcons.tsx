// 메뉴/페이지 타이틀용 아이콘 8종 — 제공받은 PNG(256px, 투명배경) 를 그대로 사용.
// 드로어에서는 .nav-ico, 페이지 제목 옆에서는 .title-ico 크기로 렌더한다.
import calendarPng from "../assets/icons/calendar.png";
import profilePng from "../assets/icons/profile.png";
import jerseyPng from "../assets/icons/jersey.png";
import statisticsPng from "../assets/icons/statistics.png";
import sportsPng from "../assets/icons/sports.png";
import searchPng from "../assets/icons/search.png";
import chartPng from "../assets/icons/chart.png";
import announcementPng from "../assets/icons/announcement.png";

// 메뉴명 → 아이콘 파일 (드로어·페이지 제목 공용)
const SRC = {
  schedule: calendarPng, // 경기일정
  players: profilePng, // 선수현황
  records: jerseyPng, // 선수 기록 상세 (등번호 22)
  leaders: statisticsPng, // 항목별 랭킹
  matchup: sportsPng, // 상대전적 (교차 배트)
  search: searchPng, // 선수 검색
  glossary: chartPng, // 지표 설명
  notice: announcementPng, // 알리는 글
} as const;

// 드로어 첫 클릭 전에 PNG 요청과 디코딩을 끝내도록 이미지 객체를 모듈 수명 동안 유지한다.
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
