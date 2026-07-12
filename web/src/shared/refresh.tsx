// 데이터 갱신 버튼 — 최신 메타 확인 후 고유 리비전으로 모든 데이터 훅을 재조회한다.
import { useState } from "react";
import { manualRefreshAndReload } from "./autoSync";

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
        await manualRefreshAndReload();
      }}
    >
      {busy ? "⏳" : "⟳"}
    </button>
  );
}
