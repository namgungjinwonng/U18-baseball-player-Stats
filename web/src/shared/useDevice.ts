// 뷰포트 폭 기준 디바이스 분기. ?device=mobile|desktop 로 강제 가능(테스트용).
import { useEffect, useState } from "react";

export type Device = "mobile" | "desktop";
const MOBILE_MAX = 640; // Nike.md mobile-landscape 경계

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
