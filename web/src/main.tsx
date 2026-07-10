import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./design/tokens.css";
import "./design/components.css";
import "./app.css";

import { useDevice } from "./shared/useDevice";
import { YearProvider } from "./shared/year";
import { initPwa } from "./shared/pwa";
import { useAutoSync } from "./shared/autoSync";
import { preloadNavIcons } from "./shared/navIcons";
import { DesktopApp } from "./desktop/DesktopApp";
import { MobileApp } from "./mobile/MobileApp";

preloadNavIcons(); // 드로어 PNG 아이콘을 미리 요청·디코딩해 첫 클릭 지연을 줄인다.
initPwa(); // manifest 주입 + 서비스워커 등록

// 데스크탑/모바일은 완전히 분리된 컴포넌트 트리(별도 운영 코드).
// 공통 데이터 계층(shared/)만 공유한다.
function Root() {
  const device = useDevice();
  useAutoSync(); // 백그라운드 복귀 시 데이터 갱신 감지 → 자동 반영
  return device === "mobile" ? <MobileApp /> : <DesktopApp />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <YearProvider>
        <Root />
      </YearProvider>
    </BrowserRouter>
  </StrictMode>
);
