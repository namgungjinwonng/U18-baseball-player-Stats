// 앱 새 실행·백그라운드 복귀·사용자 수동 요청 시 최신 메타를 확인하고 전 데이터 훅을 재조회한다.
import { useEffect } from "react";
import { setDataRevision } from "./data";

const BASE = import.meta.env.BASE_URL;
let baseline: string | null = null;
let checking: Promise<boolean> | null = null;

// 수집 워크플로는 실행마다 meta.json 의 lastUpdated 를 다시 쓰므로 서명으로 충분하다.
async function fetchSignature(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}data/meta.json?check=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const m = (await res.json()) as { lastUpdated?: string; gameCount?: number };
    return `${m.lastUpdated ?? ""}|${m.gameCount ?? ""}`;
  } catch {
    return null;
  }
}

// force=true는 메타 값이 같아도 고유 리비전으로 수동 재조회를 실행한다.
export function refreshDataNow(force = false): Promise<boolean> {
  if (checking) return checking;
  checking = (async () => {
    const sig = await fetchSignature();
    if (!sig) return false;
    const changed = baseline !== null && sig !== baseline;
    baseline = sig;
    if (force || changed) {
      setDataRevision(force ? `${sig}|manual-${Date.now()}` : sig);
    }
    return force || changed;
  })().finally(() => {
    checking = null;
  });
  return checking;
}

export function useAutoSync() {
  useEffect(() => {
    let disposed = false;

    // 앱을 완전히 종료했다가 다시 실행한 새 문서 로드 시 기준 메타를 확인한다.
    void refreshDataNow().then(() => undefined);

    const onVisible = () => {
      if (!document.hidden && !disposed) void refreshDataNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
