// 뷰포트 폭 기준 디바이스 분기. ?device=mobile|desktop 로 강제 가능(테스트용).
import { useEffect, useState } from "react";

export type Device = "mobile" | "desktop";
// 폴드6 전개(~900) / 태블릿(768-1024) 까지 모바일 UI 사용. 모바일 트리는 max-width 로 가운데 정렬되어
// 큰 화면에서도 깔끔하게 보임. 그 이상(랩탑/데스크탑) 만 정식 데스크탑 트리.
const MOBILE_MAX = 1024;

function detect(): Device {
  const forced = new URLSearchParams(window.location.search).get("device");
  if (forced === "mobile" || forced === "desktop") return forced;
  return window.innerWidth <= MOBILE_MAX ? "mobile" : "desktop";
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
