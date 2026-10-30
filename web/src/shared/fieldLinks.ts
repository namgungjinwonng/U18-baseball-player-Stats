// 야구장 원문 전체 주소를 보존하고 카카오맵·Tmap 앱 검색 링크(앱이 없으면 웹 지도·설치 페이지)를 만든다.
import type { Field } from "./types";

export const fieldAddress = (f: Pick<Field, "addr">) => f.addr?.trim() ?? "";
// scraper/src/fieldsAddressUtil.ts hasFieldAddressNumber 와 같은 규칙 — 구로2동·북문로3가·대학로291번라길 안의 숫자는 번지가 아니다.
export const hasDetailedAddress = (addr: string) => /(?:로|길)\s*\d+(?:-\d+)?(?![\d-]|번[가-힣]?길|로|길|(?:동|가|리)(?![가-힣]))|(?:동|리|가)\s*(?:산\s*)?\d+(?:-\d+)?(?![\d-]|(?:동|가|리)(?![가-힣])|번[가-힣]?길|로|길)/.test(addr);
export type MapPlatform = "android" | "ios" | "desktop";
// iPadOS 는 데스크톱 UA(Macintosh)를 쓰므로 터치 지점 수로 가린다.
export function mapPlatform(ua: string, maxTouchPoints = 0): MapPlatform {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return "ios";
  return "desktop";
}

// href = 앱이 없을 때 여는 주소(링크 길게 누르기·PC 도 이 주소). app 은 누를 때 먼저 시도하는 앱 실행 주소.
export interface MapAppLink { href: string; app?: string }
// 안드로이드 Chrome intent: 앱이 없으면 browser_fallback_url 로 넘어간다(https://developer.chrome.com/docs/android/intents).
// 패키지 이름은 확인하지 못해 넣지 않는다 — 해당 스킴을 받는 앱이 없으면 그대로 대체 주소로 간다.
const intent = (scheme: string, pathAndQuery: string, fallback: string) =>
  `intent://${pathAndQuery}#Intent;scheme=${scheme};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;

export function fieldAppLinks(f: Pick<Field, "addr" | "name" | "lat" | "lon">, platform: MapPlatform): { kakao: MapAppLink; tmap: MapAppLink | null } {
  const q = encodeURIComponent(fieldAddress(f) || f.name);
  // 카카오맵 공식 URL Scheme — 키워드 검색, p 좌표 중심(https://apis.map.kakao.com/android_v2/docs/api-guide/urlscheme/)
  const kakaoPath = `search?q=${q}&p=${f.lat},${f.lon}`;
  // 앱이 없으면 저장된 좌표에 핀을 꽂은 카카오 웹 지도 — 주소와 위치가 맞는지 눈으로 검증할 수 있다(https://apis.map.kakao.com/web/guide/).
  const kakaoMap = `https://map.kakao.com/link/map/${encodeURIComponent(f.name)},${f.lat},${f.lon}`;
  // Tmap 은 웹용 앱 실행 주소를 공식 문서에서 확인하지 못했다(문서는 네이티브 SDK 메서드만 공개). 널리 쓰이는 비공식 형식이라 실기기 확인 필요.
  const tmapPath = `search?name=${q}`;
  const tmapStoreAndroid = `https://play.google.com/store/search?q=${encodeURIComponent("티맵")}&c=apps`;
  const tmapStoreIos = "https://apps.apple.com/kr/app/id431589174";
  if (platform === "android") return {
    kakao: { href: kakaoMap, app: intent("kakaomap", kakaoPath, kakaoMap) },
    tmap: { href: tmapStoreAndroid, app: intent("tmap", tmapPath, tmapStoreAndroid) },
  };
  if (platform === "ios") return {
    kakao: { href: kakaoMap, app: `kakaomap://${kakaoPath}` },
    tmap: { href: tmapStoreIos, app: `tmap://${tmapPath}` },
  };
  return { kakao: { href: kakaoMap }, tmap: null }; // PC 에는 지도 앱이 없어 웹 지도만 둔다
}

// 앱 주소로 이동해 보고, 정해진 시간 안에 화면이 그대로면(앱이 안 열림) href 로 넘긴다.
// 안드로이드 intent 는 Chrome 이 대체 주소를 처리하지만, intent 를 못 여는 환경(PC 의 모바일 흉내 등)에서도 지도로 가도록 같은 방식을 쓴다.
// 앱이 열려 페이지가 가려지면 타이머를 지워, 나중에 돌아왔을 때 엉뚱하게 넘어가지 않게 한다.
export function openAppOrFallback(link: MapAppLink, win: Window = window, doc: Document = document, waitMs = 1500) {
  if (!link.app) { win.location.href = link.href; return; }
  const stop = () => {
    win.clearTimeout(timer);
    doc.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("pagehide", stop);
  };
  const onVisibility = () => { if (doc.visibilityState === "hidden") stop(); };
  const timer = win.setTimeout(() => {
    stop();
    if (doc.visibilityState === "visible") win.location.href = link.href;
  }, waitMs);
  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("pagehide", stop);
  win.location.href = link.app;
}

// 쓰기 권한 확인이 응답하지 않는 브라우저도 있어 선택 복사로 전환할 수 있게 제한 시간을 둔다.
export async function copyFieldAddress(address: string, write: ((text: string) => Promise<void>) | undefined, select: () => void, timeoutMs = 1500): Promise<"copied" | "selected"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!write) throw new Error("Clipboard API 없음");
    await Promise.race([write(address), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("복사 응답 대기 종료")), timeoutMs); })]);
    return "copied";
  } catch {
    select();
    return "selected";
  } finally {
    if (timer) clearTimeout(timer);
  }
}
