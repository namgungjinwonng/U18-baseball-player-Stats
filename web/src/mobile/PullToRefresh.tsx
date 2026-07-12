// 모바일 화면 최상단에서 아래로 당기면 전체 데이터 리비전을 갱신하는 제스처 컴포넌트.
import { useEffect, useRef, useState } from "react";
import { manualRefreshAndReload } from "../shared/autoSync";

const TRIGGER_PX = 64;
const MAX_PULL_PX = 96;

export function PullToRefresh() {
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const distanceRef = useRef(0);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;
    const previousBodyOverscroll = document.body.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "contain";
    document.body.style.overscrollBehaviorY = "contain";
    const onStart = (event: TouchEvent) => {
      // 모달(.modal-backdrop)이 열려 있으면 모달 내부 스크롤이므로 당겨서 새로고침 비활성.
      if (refreshing || window.scrollY > 0 || event.touches.length !== 1) return;
      if (document.querySelector(".modal-backdrop")) return;
      const target = event.target instanceof Element ? event.target : null;
      const scrollArea = target?.closest<HTMLElement>(".rank-list, .m-records-page .stat-table__scroll");
      if (scrollArea && scrollArea.scrollTop > 0) return;
      startY.current = event.touches[0].clientY;
      pulling.current = true;
    };
    const onMove = (event: TouchEvent) => {
      if (!pulling.current || startY.current === null || event.touches.length !== 1) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0 || window.scrollY > 0) {
        distanceRef.current = 0;
        setDistance(0);
        return;
      }
      event.preventDefault();
      const next = Math.min(MAX_PULL_PX, delta * 0.55);
      distanceRef.current = next;
      setDistance(next);
    };
    const onEnd = () => {
      if (!pulling.current) return;
      const shouldRefresh = distanceRef.current >= TRIGGER_PX;
      pulling.current = false;
      startY.current = null;
      distanceRef.current = 0;
      setDistance(0);
      if (shouldRefresh) {
        setRefreshing(true);
        void manualRefreshAndReload().catch(() => setRefreshing(false));
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscroll;
      document.body.style.overscrollBehaviorY = previousBodyOverscroll;
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

  return (
    <div
      className={`m-pull-refresh${refreshing ? " is-refreshing" : ""}`}
      style={{
        opacity: refreshing || distance > 4 ? 1 : 0,
        transform: `translate(-50%, ${refreshing ? 10 : Math.min(10, distance - 42)}px)`,
      }}
      aria-live="polite"
    >
      {refreshing ? "⏳ 갱신 중" : distance >= TRIGGER_PX ? "놓아서 갱신" : "↓ 당겨서 갱신"}
    </div>
  );
}
