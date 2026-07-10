import { useState } from "react";
import { Routes, Route, Link, NavLink, useNavigate } from "react-router-dom";
import "./mobile.css";
import { MHome } from "./pages/MHome";
import { MRecords } from "./pages/MRecords";
import { MMatchup } from "./pages/MMatchup";
import { MSearch } from "./pages/MSearch";
import { MPlayer } from "./pages/MPlayer";
import { Footer } from "../shared/Footer";
import { Glossary } from "../shared/Glossary";
import { LeadersView } from "../shared/LeadersView";
import { ScheduleView } from "../shared/ScheduleView";
import { TeamsView } from "../shared/TeamsView";
import { PersonView } from "../shared/PersonView";
import { Notice } from "../shared/Notice";
import { YearSelect } from "../shared/year";
import { RefreshButton } from "../shared/refresh";
import { InAppBanner, InstallButton } from "../shared/pwa";

function Drawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="m-drawer-backdrop" onClick={onClose} />
      <nav className="m-drawer">
        <Link to="/" onClick={onClose} className="brand" style={{ marginBottom: 12 }}>
          U18 BASEBALL
        </Link>
        <NavLink to="/schedule" onClick={onClose}>
          경기일정
        </NavLink>
        <NavLink to="/players" onClick={onClose}>
          선수현황
        </NavLink>
        <NavLink to="/records" onClick={onClose}>
          선수 기록 상세
        </NavLink>
        <NavLink to="/leaders/avg" onClick={onClose}>
          항목별 랭킹
        </NavLink>
        <NavLink to="/matchup" onClick={onClose}>
          상대전적
        </NavLink>
        <NavLink to="/search" onClick={onClose}>
          선수 검색
        </NavLink>
        <NavLink to="/glossary" onClick={onClose}>
          지표 설명
        </NavLink>
        <NavLink to="/notice" onClick={onClose}>
          알리는 글
        </NavLink>
      </nav>
    </>
  );
}

export function MobileApp() {
  const [drawer, setDrawer] = useState(false);
  const nav = useNavigate();
  return (
    <div className="m-shell">
      <InAppBanner />
      <header className="m-topbar">
        <div className="m-topbar__inner">
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="메뉴">
            ☰
          </button>
          <Link to="/" className="brand" title="홈으로 이동">
            U18 BASEBALL
          </Link>
          <div className="m-topbar__group">
            <InstallButton />
            <RefreshButton />
            <YearSelect />
            <button
              className="icon-btn"
              onClick={() => nav("/search")}
              aria-label="선수 검색"
            >
              ⌕
            </button>
          </div>
        </div>
      </header>

      {drawer && <Drawer onClose={() => setDrawer(false)} />}

      <main>
        <Routes>
          <Route path="/" element={<MHome />} />
          <Route path="/schedule" element={<ScheduleView wrapClass="m-page" />} />
          <Route path="/players" element={<TeamsView wrapClass="m-page" />} />
          <Route path="/person/:personNo" element={<PersonView wrapClass="m-page" />} />
          <Route path="/records" element={<MRecords />} />
          <Route path="/matchup" element={<MMatchup />} />
          <Route path="/search" element={<MSearch />} />
          <Route path="/player/:id" element={<MPlayer />} />
          <Route path="/leaders/:id" element={<LeadersView wrapClass="m-page" />} />
          <Route path="/glossary" element={<div className="m-page"><Glossary /></div>} />
          <Route path="/notice" element={<Notice wrapClass="m-page" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
