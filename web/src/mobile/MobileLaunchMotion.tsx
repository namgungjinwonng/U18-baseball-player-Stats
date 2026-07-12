// 모바일 앱 콜드 스타트 때 홈런 아크 WebM을 한 번 재생하는 전체 화면 오버레이.
import { useCallback, useEffect, useRef, useState } from "react";
import { consumeRefreshMotion } from "../shared/refreshMotion";

const BASE = import.meta.env.BASE_URL;
const EXIT_MS = 180;
const MAX_WAIT_MS = 2200;
const MOTION_VERSION = "20260712-15";
// 새로고침 직전 선택값은 한 번만 소비한다. 값이 없으면 일반 앱 실행이므로 홈런 아크 고정.
const MOTION_FILE = consumeRefreshMotion() ?? "launch-home-run.webm";

export function MobileLaunchMotion({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, reduceMotion ? 0 : EXIT_MS);
  }, [onDone, reduceMotion]);

  useEffect(() => {
    const maxWait = window.setTimeout(finish, MAX_WAIT_MS);
    if (reduceMotion) {
      const reducedWait = window.setTimeout(finish, 240);
      return () => {
        window.clearTimeout(maxWait);
        window.clearTimeout(reducedWait);
      };
    }

    const video = videoRef.current;
    if (video) void video.play().catch(finish);
    return () => window.clearTimeout(maxWait);
  }, [finish, reduceMotion]);

  return (
    <div
      className={`m-launch${leaving ? " m-launch--leaving" : ""}`}
      role="status"
      aria-label="U18 Baseball 시작 중"
    >
      {reduceMotion ? (
        <img className="m-launch__media" src={`${BASE}icon-512.png`} alt="" />
      ) : (
        <video
          ref={videoRef}
          className="m-launch__media"
          src={`${BASE}${MOTION_FILE}?v=${MOTION_VERSION}`}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={finish}
          onError={finish}
        />
      )}
    </div>
  );
}
