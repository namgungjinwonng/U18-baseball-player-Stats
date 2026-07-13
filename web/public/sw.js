// 서비스 워커 — network-first(데이터 최신 우선), 오프라인 시 캐시 폴백.
// u81-baseball 방식 참고.
const CACHE = "u18-baseball-v4"; // v4: 다년(2024·2025) 데이터 도입 + matchups 병합 재구성 — 구 캐시 일괄 정리

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
