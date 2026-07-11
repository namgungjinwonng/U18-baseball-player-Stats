// 모바일 앱 콜드 스타트 때 홈런 아크 WebM을 한 번 재생하는 전체 화면 오버레이.
import { useCallback, useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL;
const EXIT_MS = 180;
const MAX_WAIT_MS = 2200;

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
          src={`${BASE}launch-home-run.webm`}
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
