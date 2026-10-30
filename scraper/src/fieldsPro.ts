// KBO 공식 주소로 프로구장 검색을 보완하고 실패를 호출자에게 명시적으로 돌려준다.
import type { Field } from "./fieldsUtil.js";

const source = "https://www.koreabaseball.com/Kbo/League/TeamInfo.aspx";
export const PRO_STADIUM_DETAILS = [
  { name: "잠실야구장", sido: "서울", sigungu: "송파구", addr: "서울특별시 송파구 올림픽로 25" },
  { name: "고척스카이돔", sido: "서울", sigungu: "구로구", addr: "서울특별시 구로구 경인로 430" },
  { name: "인천SSG랜더스필드", sido: "인천", sigungu: "미추홀구", addr: "인천광역시 미추홀구 매소홀로 618" },
  { name: "수원KT위즈파크", sido: "경기", sigungu: "수원시", addr: "경기도 수원시 장안구 경수대로 893" },
  { name: "대전한화생명볼파크", sido: "대전", sigungu: "중구", addr: "대전광역시 중구 대종로 373" },
  { name: "대구삼성라이온즈파크", sido: "대구", sigungu: "수성구", addr: "대구광역시 수성구 야구전설로 1" },
  { name: "광주기아챔피언스필드", sido: "광주", sigungu: "북구", addr: "광주광역시 북구 서림로 10" },
  { name: "사직야구장", sido: "부산", sigungu: "동래구", addr: "부산광역시 동래구 사직로 45" },
  { name: "창원NC파크", sido: "경남", sigungu: "창원시", addr: "경상남도 창원시 마산회원구 삼호로 63" },
];
type Stadium = typeof PRO_STADIUM_DETAILS[number];
export type ProLocation = { lat: number; lon: number; sido: string; sigungu: string; type?: string };
export async function resolveProStadium(stadium: Stadium, old: Field | undefined,
  locate: (query: string) => Promise<ProLocation | null>): Promise<Field | null> {
  const common = { id: `pro:${stadium.name}`, ...stadium, kind: "프로야구장" as const, source };
  if (old) return { ...old, ...common }; // 게시 좌표는 다시 검색하지 않는다.
  for (const query of [stadium.name, stadium.addr]) {
    const hit = await locate(query);
    if (!hit || hit.sido !== stadium.sido || hit.sigungu !== stadium.sigungu
      || /^(administrative|city|town|village|suburb|county)$/.test(hit.type ?? "")) continue;
    const fallback = query === stadium.addr;
    return { ...common, lat: hit.lat, lon: hit.lon, approx: fallback,
      note: fallback ? "KBO 공식 주소 검색 위치 · 시설 내 구장 중심은 별도 확인 필요" : "구장 이름 검색 위치 · 주소는 KBO 공식 안내" };
  }
  return null;
}
