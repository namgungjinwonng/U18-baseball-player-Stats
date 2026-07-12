// 뒤로가기 = 모달 닫기 훅 — 모달이 열릴 때 히스토리 엔트리를 1개 쌓고,
// 뒤로가기(popstate)면 페이지 이동 대신 onClose 만 호출한다.
// UI 닫기(X·배경 클릭·ESC)는 반환된 close() 를 쓸 것 — history.back() 으로
// 쌓아둔 엔트리를 소거하며 닫아, 다음 뒤로가기가 이중으로 필요하지 않게 한다.
// 모달을 연 채 페이지 이동(nav)할 땐 호출부에서 replace 내비게이션으로 엔트리를 대체한다.
import { useCallback, useEffect, useRef } from "react";

export function useModalHistory(open: boolean, onClose: () => void): () => void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    // StrictMode(dev)의 effect 이중 실행 대비 — 이미 모달 엔트리 위면 다시 쌓지 않는다.
    // cleanup 에서 back() 을 부르면 이중 실행 시 모달이 즉시 닫혀버리므로 리스너 제거만 한다.
    if (!window.history.state?.modal) {
      window.history.pushState({ modal: true }, "");
    }
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  return useCallback(() => {
    if (openRef.current) window.history.back();
  }, []);
}
