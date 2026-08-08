// 뷰포트 폭 기준 디바이스 분기. ?device=mobile|desktop 로 강제 가능(테스트용).
import { useEffect, useState } from "react";

export type Device = "mobile" | "desktop";
// 일반 화면은 1024px까지 모바일 UI를 사용한다. 폴더블 전개·태블릿처럼 주 입력이 터치인 화면은
// 가로 viewport가 더 넓으므로 1366px까지 모바일 UI를 유지한다.
const MOBILE_MAX = 1024;
const TOUCH_MOBILE_MAX = 1366;

export function deviceForViewport(width: number, touchPrimary: boolean, forced?: string | null): Device {
  if (forced === "mobile" || forced === "desktop") return forced;
  return width <= MOBILE_MAX || (touchPrimary && width <= TOUCH_MOBILE_MAX) ? "mobile" : "desktop";
}

function detect(): Device {
  const forced = new URLSearchParams(window.location.search).get("device");
  const touchPrimary = window.matchMedia("(pointer: coarse)").matches;
  return deviceForViewport(window.innerWidth, touchPrimary, forced);
}

export function useDevice(): Device {
  const [device, setDevice] = useState<Device>(detect);
  useEffect(() => {
    const onResize = () => setDevice(detect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return device;
}
