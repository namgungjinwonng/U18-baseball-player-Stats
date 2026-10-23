import { Routes, Route, NavLink, useNavigate, Link } from "react-router-dom";
import { Fragment, useState } from "react";
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
import { VersusView } from "../shared/VersusView";
import { TeamIndex, TeamView } from "../shared/TeamView";
import { CompareView } from "../shared/CompareView";
import { Notice } from "../shared/Notice";
import { AiSettingsView } from "../shared/ai/AiSettingsView";
import { SeasonRecordsGate } from "../shared/SeasonEmpty";
import { HomeIcon } from "../shared/HomeIcon";
import { Ico } from "../shared/navIcons";
import { NAV_GROUPS } from "../shared/navMenu";
import { YearSelect } from "../shared/year";
import { RefreshButton } from "../shared/refresh";
import { InAppBanner, InstallButton } from "../shared/pwa";
import { MenuIcon, SearchIcon } from "../shared/LineIcons";

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
      <SearchIcon />
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
            <MenuIcon />
          </button>
          <Link to="/" className="brand" title="홈으로 이동" onClick={() => setMenuOpen(false)}>
            <HomeIcon />
            <span>U18 BASEBALL</span>
          </Link>
          <div className="nav-links">
            {/* 큰 카테고리 사이에는 얇은 구분선만 — 순서는 shared/navMenu.ts */}
            {NAV_GROUPS.map((group, gi) => (
              <Fragment key={group.title}>
                {gi > 0 && <span className="nav-links__sep" aria-hidden />}
                {group.items.filter((item) => !item.drawerOnly).map((item) => (
                  <NavLink key={item.to} to={item.to}>{item.label}</NavLink>
                ))}
              </Fragment>
            ))}
          </div>
          <div className="nav-right">
            <RefreshButton />
            <YearSelect />
            <DesktopSearch />
          </div>
        </div>
        {menuOpen && (
          <div className="nav-drawer">
            {NAV_GROUPS.map((group) => (
              <Fragment key={group.title}>
                <h3 className="nav-drawer__title">{group.title}</h3>
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}><Ico name={item.icon} />{item.label}</NavLink>
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<SeasonRecordsGate wrapClass="container page"><HomePage /></SeasonRecordsGate>} />
          <Route path="/schedule" element={<ScheduleView wrapClass="container page" />} />
          <Route path="/players" element={<TeamsView wrapClass="container page" />} />
          <Route path="/person/:personNo" element={<PersonView wrapClass="container page" />} />
          <Route path="/records" element={<SeasonRecordsGate wrapClass="container page"><RecordsPage /></SeasonRecordsGate>} />
          <Route path="/matchup" element={<SeasonRecordsGate wrapClass="container page"><MatchupPage /></SeasonRecordsGate>} />
          <Route path="/versus" element={<VersusView wrapClass="container page" />} />
          <Route path="/team" element={<TeamIndex wrapClass="container page" />} />
          <Route path="/team/:name" element={<SeasonRecordsGate wrapClass="container page"><TeamView wrapClass="container page" /></SeasonRecordsGate>} />
          <Route path="/compare" element={<SeasonRecordsGate wrapClass="container page"><CompareView wrapClass="container page" /></SeasonRecordsGate>} />
          <Route path="/search" element={<SeasonRecordsGate wrapClass="container page"><SearchPage /></SeasonRecordsGate>} />
          <Route path="/player/:id" element={<SeasonRecordsGate wrapClass="container page"><PlayerPage /></SeasonRecordsGate>} />
          <Route path="/leaders/:id" element={<SeasonRecordsGate wrapClass="container page"><LeadersView wrapClass="container page" /></SeasonRecordsGate>} />
          <Route path="/glossary" element={<div className="container page"><Glossary /></div>} />
          <Route path="/notice" element={<Notice wrapClass="container page" />} />
          <Route path="/ai-settings" element={<AiSettingsView wrapClass="container page" />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
