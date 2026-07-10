import { Routes, Route, NavLink, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { RecordsPage } from "./pages/RecordsPage";
import { MatchupPage } from "./pages/MatchupPage";
import { SearchPage } from "./pages/SearchPage";
import { PlayerPage } from "./pages/PlayerPage";
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

// 상단바 검색 = 선수 검색 페이지로 바로 이동 (검색 UI 를 /search 하나로 통일)
function DesktopSearch() {
  const nav = useNavigate();
  return (
    <button
      type="button"
      className="search-pill search-pill--link"
      style={{ flex: 1 }}
      onClick={() => nav("/search")}
      aria-label="선수 검색 열기"
    >
      <span aria-hidden>⌕</span>
      <span className="search-pill__ph">선수 검색 (이름 또는 팀+등번호 가능)</span>
    </button>
  );
}

export function DesktopApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <InAppBanner />
      <div className="utility-bar">
        <div className="container">
          <span>고교 · U18</span>
          <InstallButton />
        </div>
      </div>
      <nav className="primary-nav">
        <div className="container">
          <button
            className="nav-hamburger icon-btn"
            aria-label="메뉴"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
          <Link to="/" className="brand" title="홈으로 이동" onClick={() => setMenuOpen(false)}>
            U18 BASEBALL
          </Link>
          <div className="nav-links">
            <NavLink to="/schedule">경기일정</NavLink>
            <NavLink to="/players">선수현황</NavLink>
            <NavLink to="/records">선수 기록 상세</NavLink>
            <NavLink to="/leaders/avg">항목별 랭킹</NavLink>
            <NavLink to="/matchup">상대전적</NavLink>
            <NavLink to="/search">선수 검색</NavLink>
            <NavLink to="/glossary">지표 설명</NavLink>
            <NavLink to="/notice">알리는 글</NavLink>
          </div>
          <div className="nav-right">
            <RefreshButton />
            <YearSelect />
            <DesktopSearch />
          </div>
        </div>
        {menuOpen && (
          <div className="nav-drawer">
            <NavLink to="/schedule" onClick={() => setMenuOpen(false)}>경기일정</NavLink>
            <NavLink to="/players" onClick={() => setMenuOpen(false)}>선수현황</NavLink>
            <NavLink to="/records" onClick={() => setMenuOpen(false)}>선수 기록 상세</NavLink>
            <NavLink to="/leaders/avg" onClick={() => setMenuOpen(false)}>항목별 랭킹</NavLink>
            <NavLink to="/matchup" onClick={() => setMenuOpen(false)}>상대전적</NavLink>
            <NavLink to="/search" onClick={() => setMenuOpen(false)}>선수 검색</NavLink>
            <NavLink to="/glossary" onClick={() => setMenuOpen(false)}>지표 설명</NavLink>
            <NavLink to="/notice" onClick={() => setMenuOpen(false)}>알리는 글</NavLink>
          </div>
        )}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/schedule" element={<ScheduleView wrapClass="container page" />} />
          <Route path="/players" element={<TeamsView wrapClass="container page" />} />
          <Route path="/person/:personNo" element={<PersonView wrapClass="container page" />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/matchup" element={<MatchupPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/player/:id" element={<PlayerPage />} />
          <Route path="/leaders/:id" element={<LeadersView wrapClass="container page" />} />
          <Route path="/glossary" element={<div className="container page"><Glossary /></div>} />
          <Route path="/notice" element={<Notice wrapClass="container page" />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
