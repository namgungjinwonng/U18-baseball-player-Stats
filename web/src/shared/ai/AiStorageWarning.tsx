// 기기 내 분석 기록이 1,000건 또는 20MB에 도달하면 자동 삭제 없이 용량 경고 팝업을 표시한다.
import { useEffect, useState } from "react";
import { useModalHistory } from "../useModalHistory";
import { AI_CACHE_CHANGED, acknowledgeStorageWarning, pendingStorageWarning, storageSizeText, type StorageStats } from "./store";

export function AiStorageWarning() {
  const [warning, setWarning] = useState<StorageStats | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => { void pendingStorageWarning().then((value) => { if (alive) setWarning(value); }).catch(() => {}); };
    check();
    window.addEventListener(AI_CACHE_CHANGED, check);
    return () => { alive = false; window.removeEventListener(AI_CACHE_CHANGED, check); };
  }, []);
  const dismiss = () => {
    setWarning(null);
    void acknowledgeStorageWarning().catch(() => {});
  };
  const close = useModalHistory(!!warning, dismiss);
  if (!warning) return null;
  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-label="AI 분석 저장공간 안내">
      <div className="modal-card">
        <h3>이 기기에 저장된 분석이 많습니다</h3>
        <p>분석 {warning.count.toLocaleString()}개 · 약 {storageSizeText(warning.bytes)}를 보관하고 있습니다.</p>
        <p>분석 1,000개 또는 20MB 이상이면 알려드립니다. 기록은 자동 삭제하지 않습니다. 매치업 AI분석 설정에서 보관 주기를 조정하거나 기록을 정리할 수 있습니다.</p>
        <button type="button" className="btn btn--primary btn--sm" onClick={close}>확인</button>
      </div>
    </div>
  );
}
