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
        <NavLink to="/records" onClick={onClose}>
          선수 기록
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
      </nav>
    </>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  return (
    <div className="m-search-overlay">
      <div className="m-search-overlay__top">
        <form
          className="search-pill"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) {
              nav(`/search?q=${encodeURIComponent(q.trim())}`);
              onClose();
            }
          }}
        >
          <span aria-hidden>⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="선수 이름 검색"
            aria-label="선수 이름 검색"
          />
        </form>
        <button className="icon-btn" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
    </div>
  );
}

export function MobileApp() {
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  return (
    <div className="m-shell">
      <InAppBanner />
      <header className="m-topbar">
        <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="메뉴">
          ☰
        </button>
        <Link to="/" className="brand">
          U18 BASEBALL
        </Link>
        <div className="m-topbar__group">
          <InstallButton />
          <RefreshButton />
          <YearSelect />
          <button
            className="icon-btn"
            onClick={() => setSearch(true)}
            aria-label="검색"
          >
            ⌕
          </button>
        </div>
      </header>

      {drawer && <Drawer onClose={() => setDrawer(false)} />}
      {search && <SearchOverlay onClose={() => setSearch(false)} />}

      <main>
        <Routes>
          <Route path="/" element={<MHome />} />
          <Route path="/records" element={<MRecords />} />
          <Route path="/matchup" element={<MMatchup />} />
          <Route path="/search" element={<MSearch />} />
          <Route path="/player/:id" element={<MPlayer />} />
          <Route path="/glossary" element={<div className="m-page"><Glossary /></div>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
