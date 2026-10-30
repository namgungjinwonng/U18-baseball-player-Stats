// 번지·건물번호·괄호를 포함한 전체 주소가 표시·복사·지도 URL에서 잘리지 않는지 검증한다.
import assert from "node:assert/strict";
import { copyFieldAddress, fieldAddress, fieldAppLinks, hasDetailedAddress, mapPlatform, openAppOrFallback } from "./fieldLinks";
// 카카오맵 앱 검색어 — 전체 주소가 잘리지 않아야 한다.
const query = (x: Parameters<typeof fieldAppLinks>[0]) => decodeURIComponent(fieldAppLinks(x, "ios").kakao.app!.split("q=")[1].split("&p=")[0]);

const addr = "대전광역시 중구 대흥로 110 (대흥동 320-2번지)";
const f = { name: "대전고등학교", addr, lat: 36.322, lon: 127.422 };
assert.equal(fieldAddress(f), addr);
assert.equal(query(f), addr);
assert.ok(hasDetailedAddress(addr));
assert.ok(hasDetailedAddress("경기도 고양시 덕양구 행주동 12-3"));
assert.ok(!hasDetailedAddress("서울특별시 강동구 고덕동"));
assert.ok(!hasDetailedAddress("경기도 고양시 덕이로172번길"), "도로명 안의 숫자를 건물번호로 오인하지 않음");
assert.ok(hasDetailedAddress("경기도 고양시 덕이로172번길 10"));
assert.ok(!hasDetailedAddress("장대들길 송포동 장항1동 일산동구"));
assert.ok(!hasDetailedAddress("서울특별시 구로구 구로2동"), "행정동 이름 안의 숫자는 번지가 아님");
assert.ok(!hasDetailedAddress("대전광역시 유성구 어은동 대학로291번라길"));
assert.ok(!hasDetailedAddress("충청북도 청주시 상당구 북문로3가 상당로204번길"));
assert.ok(hasDetailedAddress("대구광역시 북구 고성3가 2"));
assert.ok(hasDetailedAddress("경상남도 함안군 가야읍 함안대로 619 (가야리 9-2)"));
const janghang = { name: "고양장항야구장", addr: "경기도 고양시 일산동구 장항동 660-65번지 일원", lat: 37.650535, lon: 126.737589, approx: true };
assert.equal(query(janghang), janghang.addr);
assert.equal(fieldAddress({ addr: "" }), "");
assert.equal(query({ ...f, addr: undefined }), f.name);
const long = "경기도 고양시 일산동구 중앙로 1234-5 (장항동, 아주 긴 시설 이름과 상세 주소 2층 204호)";
assert.equal(fieldAddress({ addr: long }), long);
assert.ok(fieldAppLinks({ ...f, addr: "서울특별시 중구 테스트길 1, 2층 #주소" }, "ios").kakao.app!.includes("%23"));
let copied = "", selected = 0;
assert.equal(await copyFieldAddress(addr, async () => { copied = addr; }, () => { selected++; }), "copied");
assert.equal(copied, addr);
assert.equal(selected, 0);
assert.equal(await copyFieldAddress(addr, undefined, () => { selected++; }), "selected");
assert.equal(await copyFieldAddress(addr, async () => { throw new Error("권한 없음"); }, () => { selected++; }), "selected");
assert.equal(await copyFieldAddress(addr, () => new Promise(() => {}), () => { selected++; }, 10), "selected");
assert.equal(selected, 3);
// 기기 판별 — iPadOS 는 Macintosh UA 라 터치 지점으로 가린다.
assert.equal(mapPlatform("Mozilla/5.0 (Linux; Android 14; SM-F956N) Chrome/141"), "android");
assert.equal(mapPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
assert.equal(mapPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ios");
assert.equal(mapPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "desktop");
assert.equal(mapPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "desktop");

// 카카오맵 — 앱이 없거나 PC 면 저장 좌표에 핀을 꽂은 웹 지도(주소·위치 검증용).
const kakaoMap = `https://map.kakao.com/link/map/${encodeURIComponent(f.name)},36.322,127.422`;
assert.deepEqual(fieldAppLinks(f, "desktop").kakao, { href: kakaoMap });
// 공식 스킴 kakaomap://search?q=&p=위도,경도. 안드로이드는 intent 로 연다.
const android = fieldAppLinks(f, "android");
assert.equal(android.kakao.href, kakaoMap);
const [kakaoTarget, kakaoExtras] = android.kakao.app!.split("#Intent;");
assert.equal(kakaoTarget, `intent://search?q=${encodeURIComponent(addr)}&p=36.322,127.422`);
assert.ok(kakaoExtras.startsWith("scheme=kakaomap;") && kakaoExtras.endsWith(";end"));
assert.equal(decodeURIComponent(kakaoExtras.match(/S\.browser_fallback_url=([^;]+)/)![1]), kakaoMap, "앱 없으면 웹 지도");
assert.ok(!android.kakao.app!.includes("package="), "확인 못 한 패키지 이름은 넣지 않는다");
const ios = fieldAppLinks(f, "ios");
assert.equal(ios.kakao.app, `kakaomap://search?q=${encodeURIComponent(addr)}&p=36.322,127.422`);
assert.equal(ios.kakao.href, kakaoMap);
// Tmap — 모바일에서만. 앱이 없으면 설치 페이지. 전체 주소가 잘리지 않는다.
assert.equal(decodeURIComponent(android.tmap!.app!.split("#Intent;")[0].split("name=")[1]), addr);
assert.ok(android.tmap!.app!.includes("scheme=tmap;"));
assert.equal(decodeURIComponent(android.tmap!.app!.match(/S\.browser_fallback_url=([^;]+)/)![1]), android.tmap!.href);
assert.equal(android.tmap!.href, `https://play.google.com/store/search?q=${encodeURIComponent("티맵")}&c=apps`);
assert.equal(ios.tmap!.app, `tmap://search?name=${encodeURIComponent(addr)}`);
assert.equal(ios.tmap!.href, "https://apps.apple.com/kr/app/id431589174");
assert.equal(fieldAppLinks(f, "desktop").tmap, null, "PC 에는 Tmap 앱 링크를 두지 않는다");
// 주소의 #·& 가 intent 구분자를 깨지 않는다.
assert.ok(!fieldAppLinks({ ...f, addr: "테스트길 1 #2 & 3" }, "android").kakao.app!.split("#Intent;")[0].includes("#"));

// 앱 실행 시도 — 앱이 열려 화면이 가려지면 대체 주소로 넘기지 않고, 그대로면 넘긴다.
const fakeEnv = (hideOnLaunch: boolean) => {
  const listeners: Record<string, (() => void)[]> = {};
  let pending: (() => void) | null = null;
  const doc = { visibilityState: "visible", addEventListener: (t: string, f: () => void) => (listeners[t] ??= []).push(f),
    removeEventListener: (t: string, f: () => void) => { listeners[t] = (listeners[t] ?? []).filter((x) => x !== f); } };
  const win = {
    location: { set href(v: string) { visits.push(v); if (hideOnLaunch && v.includes("://") && !v.startsWith("http")) { doc.visibilityState = "hidden"; listeners.visibilitychange?.forEach((l) => l()); } } },
    setTimeout: (f: () => void) => { pending = f; return 1; }, clearTimeout: () => { pending = null; },
    addEventListener: doc.addEventListener, removeEventListener: doc.removeEventListener,
  };
  const visits: string[] = [];
  return { win: win as unknown as Window, doc: doc as unknown as Document, visits, fire: () => pending?.() };
};
const opened = fakeEnv(true);
openAppOrFallback(ios.kakao, opened.win, opened.doc);
opened.fire();
assert.deepEqual(opened.visits, [ios.kakao.app], "앱이 열리면 웹으로 넘기지 않음");
const notInstalled = fakeEnv(false);
openAppOrFallback(ios.tmap!, notInstalled.win, notInstalled.doc);
notInstalled.fire();
assert.deepEqual(notInstalled.visits, [ios.tmap!.app, ios.tmap!.href], "앱이 없으면 설치 페이지로");
const noIntent = fakeEnv(false);
openAppOrFallback(android.kakao, noIntent.win, noIntent.doc);
noIntent.fire();
assert.deepEqual(noIntent.visits, [android.kakao.app, kakaoMap], "intent 를 못 열면 웹 지도로");
const pc = fakeEnv(false);
openAppOrFallback(fieldAppLinks(f, "desktop").kakao, pc.win, pc.doc);
assert.deepEqual(pc.visits, [kakaoMap], "PC 는 바로 웹 지도");
console.log("야구장 전체 주소·번지 보존·지도 URL·앱 실행 링크 테스트 통과");
