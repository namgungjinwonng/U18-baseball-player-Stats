// 공용 푸터 — 비상업/저작권 고지 (데스크탑·모바일 공통).
import { useLocation } from "react-router-dom";
export function Footer() {
  const fieldsPage = useLocation().pathname === "/fields";
  return (
    <footer className="site-footer">
      {fieldsPage ? "본 앱은 비상업적 목적으로 운영됩니다. 야구장 자료는 각 제공기관·OpenStreetMap의 이용 조건을 따릅니다." : "본 앱은 비상업적 목적으로 운영되며, 모든 데이터 권한은 대한야구소프트볼협회에 있습니다."}
    </footer>
  );
}
