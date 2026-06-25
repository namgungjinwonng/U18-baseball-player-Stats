import { Routes, Route, NavLink, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { RecordsPage } from "./pages/RecordsPage";
import { MatchupPage } from "./pages/MatchupPage";
import { SearchPage } from "./pages/SearchPage";
import { PlayerPage } from "./pages/PlayerPage";
import { Footer } from "../shared/Footer";
import { Glossary } from "../shared/Glossary";
import { YearSelect } from "../shared/year";
import { RefreshButton } from "../shared/refresh";
import { InAppBanner, InstallButton } from "../shared/pwa";

function DesktopSearch() {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const nav = useNavigate();
  return (
    <form
      className={`search-pill ${focused ? "search-pill--focused" : ""}`}
      style={{ flex: 1 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <span aria-hidden>⌕</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="선수 이름 검색"
        aria-label="선수 이름 검색"
      />
    </form>
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
          <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
            U18 BASEBALL
          </Link>
          <div className="nav-links">
            <NavLink to="/records">선수 기록</NavLink>
            <NavLink to="/matchup">상대전적</NavLink>
            <NavLink to="/search">선수 검색</NavLink>
            <NavLink to="/glossary">지표 설명</NavLink>
          </div>
          <div className="nav-right">
            <RefreshButton />
            <YearSelect />
            <DesktopSearch />
          </div>
        </div>
        {menuOpen && (
          <div className="nav-drawer">
            <NavLink to="/records" onClick={() => setMenuOpen(false)}>선수 기록</NavLink>
            <NavLink to="/matchup" onClick={() => setMenuOpen(false)}>상대전적</NavLink>
            <NavLink to="/search" onClick={() => setMenuOpen(false)}>선수 검색</NavLink>
            <NavLink to="/glossary" onClick={() => setMenuOpen(false)}>지표 설명</NavLink>
          </div>
        )}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/matchup" element={<MatchupPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/player/:id" element={<PlayerPage />} />
          <Route path="/glossary" element={<div className="container page"><Glossary /></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
