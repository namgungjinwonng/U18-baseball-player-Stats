// 앱 복귀(백그라운드 → 포그라운드) 시 데이터 갱신 감지 — meta.json 서명 비교 후 전 훅 재조회.
// 서비스워커가 network-first 라 새로 열 때는 항상 최신이지만, 메모리에 살아있는 SPA 는
// 복귀해도 재요청이 없으므로 여기서 가볍게 체크한다.
import { useEffect } from "react";
import { bumpDataVersion } from "./data";

const BASE = import.meta.env.BASE_URL;
const MIN_INTERVAL_MS = 30_000; // 복귀가 잦아도 30초에 1회만 체크

// 수집 워크플로는 실행마다 meta.json 의 lastUpdated 를 다시 쓰므로 서명으로 충분하다.
async function fetchSignature(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}data/meta.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const m = (await res.json()) as { lastUpdated?: string; gameCount?: number };
    return `${m.lastUpdated ?? ""}|${m.gameCount ?? ""}`;
  } catch {
    return null;
  }
}

export function useAutoSync() {
  useEffect(() => {
    let baseline: string | null = null;
    let lastCheck = 0;
    let disposed = false;

    // 최초 로드 시점 서명을 기준값으로 저장
    fetchSignature().then((sig) => {
      if (!disposed && sig) baseline = sig;
    });

    const check = async () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastCheck < MIN_INTERVAL_MS) return;
      lastCheck = now;
      const sig = await fetchSignature();
      if (disposed || !sig) return;
      if (baseline && sig !== baseline) bumpDataVersion();
      baseline = sig;
    };

    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);
}
