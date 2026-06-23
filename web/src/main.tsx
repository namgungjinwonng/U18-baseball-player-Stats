import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./design/tokens.css";
import "./design/components.css";
import "./app.css";

import { useDevice } from "./shared/useDevice";
import { DesktopApp } from "./desktop/DesktopApp";
import { MobileApp } from "./mobile/MobileApp";

// 데스크탑/모바일은 완전히 분리된 컴포넌트 트리(별도 운영 코드).
// 공통 데이터 계층(shared/)만 공유한다.
function Root() {
  const device = useDevice();
  return device === "mobile" ? <MobileApp /> : <DesktopApp />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Root />
    </BrowserRouter>
  </StrictMode>
);
