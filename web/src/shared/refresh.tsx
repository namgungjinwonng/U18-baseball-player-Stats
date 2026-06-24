// 데이터 갱신(새로고침) 버튼 — u81 reloadPage 방식 미러:
// 서비스워커 캐시를 비우고 최신 데이터로 강제 리로드.
import { useState } from "react";

const BASE = import.meta.env.BASE_URL;

async function hardRefresh() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update()));
    }
    // HTTP 캐시 우회로 핵심 데이터 강제 재요청
    await Promise.all(
      ["years.json", "meta.json"].map((u) =>
        fetch(`${BASE}data/${u}`, { cache: "reload" }).catch(() => {})
      )
    );
  } catch {
    /* 무시 */
  }
  location.reload();
}

export function RefreshButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="refresh-btn"
      title="데이터 갱신"
      aria-label="데이터 갱신"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await hardRefresh();
      }}
    >
      {busy ? "⏳" : "⟳"}
    </button>
  );
}
