// 모바일 화면 최상단에서 아래로 당기면 전체 데이터 리비전을 갱신하는 제스처 컴포넌트.
// 스크롤과 새로고침을 구분한다 — 처음 ENGAGE_PX 만큼은 판단을 보류(네이티브 스크롤 우선)하고,
// 빠른 하향 플릭(스크롤 의도)은 무시한 채 느리고 의도적인 당김일 때만 새로고침 제스처를 잡는다.
import { useEffect, useRef, useState } from "react";
import { manualRefreshAndReload } from "../shared/autoSync";

const TRIGGER_PX = 64; // 놓았을 때 갱신되는 최소 당김 거리(감쇠 후 값)
const MAX_PULL_PX = 96;
const ENGAGE_PX = 14; // 이 거리 전에는 스크롤/당김 판단을 보류(스크롤을 막지 않음)
const MAX_ENGAGE_VELOCITY = 0.7; // px/ms — 이보다 빠른 하향 플릭은 스크롤로 간주(새로고침 안 함)

export function PullToRefresh() {
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const pulling = useRef(false); // 최상단에서 시작된 하향 제스처 추적 중
  const engaged = useRef(false); // 당김으로 확정되어 스크롤을 막고 인디케이터를 그리는 중
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
      startTime.current = event.timeStamp;
      pulling.current = true;
      engaged.current = false;
    };
    const onMove = (event: TouchEvent) => {
      if (!pulling.current || startY.current === null || event.touches.length !== 1) return;
      const delta = event.touches[0].clientY - startY.current;

      // 위로 스크롤(delta<=0)하거나 이미 페이지가 내려가 있으면 당김이 아님 → 네이티브 스크롤에 양보.
      if (delta <= 0 || window.scrollY > 0) {
        if (!engaged.current) pulling.current = false;
        distanceRef.current = 0;
        setDistance(0);
        return;
      }

      // 아직 당김으로 확정 전: 데드존 통과 + 속도로 "스크롤 플릭"과 "의도적 당김"을 구분.
      if (!engaged.current) {
        if (delta < ENGAGE_PX) return; // 데드존 — 아직 스크롤을 막지 않음
        const elapsed = event.timeStamp - startTime.current;
        const velocity = elapsed > 0 ? delta / elapsed : Infinity; // px/ms
        if (velocity > MAX_ENGAGE_VELOCITY) {
          // 빠른 하향 플릭 = 스크롤 의도 → 이 제스처에서는 새로고침 비활성.
          pulling.current = false;
          return;
        }
        engaged.current = true; // 느리고 의도적인 당김으로 확정
      }

      event.preventDefault();
      const next = Math.min(MAX_PULL_PX, (delta - ENGAGE_PX) * 0.55);
      distanceRef.current = next;
      setDistance(next);
    };
    const onEnd = () => {
      if (!pulling.current) return;
      const shouldRefresh = engaged.current && distanceRef.current >= TRIGGER_PX;
      pulling.current = false;
      engaged.current = false;
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
