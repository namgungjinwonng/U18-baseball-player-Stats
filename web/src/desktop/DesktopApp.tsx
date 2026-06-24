import { Routes, Route, NavLink, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { RecordsPage } from "./pages/RecordsPage";
import { MatchupPage } from "./pages/MatchupPage";
import { SearchPage } from "./pages/SearchPage";
import { PlayerPage } from "./pages/PlayerPage";
import { Footer } from "../shared/Footer";
import { YearSelect } from "../shared/year";
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
          <Link to="/" className="brand">
            U18 BASEBALL
          </Link>
          <div className="nav-links">
            <NavLink to="/records">선수 기록</NavLink>
            <NavLink to="/matchup">상대전적</NavLink>
            <NavLink to="/search">선수 검색</NavLink>
          </div>
          <div className="nav-right">
            <YearSelect />
            <DesktopSearch />
          </div>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/matchup" element={<MatchupPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
