// 서비스 워커 — network-first(데이터 최신 우선), 오프라인 시 캐시 폴백.
// u81-baseball 방식 참고.
const CACHE = "u18-baseball-v10"; // v10: 학교 정보 종합등급·2열 카드 — 설치본이 새 서비스워커로 갱신되며 구 캐시 정리
// (이전 v9: 매치업 경기분석 개편(분석 엔진 지연 로딩 청크))
// (이전 v8: 좋음 = 레드 색 규칙 반전)
// (이전 v7: 매치업 학교 선택 화면·학교별 규정·시합 기준 등급)
// (이전 v6: 메뉴 카테고리·학교 정보 등급·매치업 맞대결표 개편)
// (이전 v5: 학교 대전·팀 상세·선수 비교·리그 등급 UI 도입)
// (이전 v4: 다년(2024·2025) 데이터 도입 + matchups 병합 재구성)

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // 문서 재로드는 HTTP 10분 캐시를 우회해 최신 해시 번들의 index.html을 받는다.
  const request = e.request.mode === "navigate"
    ? new Request(e.request, { cache: "reload" })
    : e.request;
  e.respondWith(
    fetch(request)
      .then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
