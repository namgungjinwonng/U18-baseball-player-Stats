// 선수현황 화면 (데스크탑/모바일 공용) — 팀 카드 그리드 + 팀 상세 모달 + 선수 검색.
// 페이지 구성은 u81-baseball/generate_html.py 의 u18_players.html 과 동일,
// 스타일만 이 저장소의 디자인 토큰(Nike.md)을 따른다.
// 선수 행 클릭 → 앱 내 선수 상세(기록 보유 시 /player/:id, 무기록 시 /person/:personNo).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePlayerIndex, useTeams } from "./data";
import { kbsaPlayerUrl } from "./kbsa";
import { GRADE_COLORS, POS_COLORS } from "./badgeColors";
import { Ico } from "./navIcons";
import { PagedCardGrid } from "./PagedCardGrid";
import type { TeamPlayerEntry, TeamStaffEntry } from "./types";

const POS_ORDER = ["투수", "포수", "내야수", "외야수", "미지정"];
const getPos = (p: TeamPlayerEntry) => p.position || "미지정";
const getGrade = (p: TeamPlayerEntry) => p.grade || "미지정";

// 색상 아웃라인 필터 칩 (선택 시 해당 색으로 반전 — 원본 pos/grade-filter-btn 이식)
function ColorChip({
  color, active, onClick, children,
}: {
  color: string; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="chip tv-color-chip"
      style={{
        borderColor: color,
        color: active ? "#fff" : color,
        background: active ? color : "var(--color-canvas)",
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// 선수 테이블 — 가로 스크롤 없이 한 화면(고정 레이아웃 + % 폭, 원본 모달/검색 테이블 이식)
function PlayerTable({
  rows, showTeam, scrollY, onOpen,
}: {
  rows: TeamPlayerEntry[];
  showTeam?: boolean;
  scrollY?: boolean; // 팀 모달: 표 영역만 세로 스크롤 (모달 크기 유지)
  onOpen: (p: TeamPlayerEntry) => void;
}) {
  // 원본 % 폭: 모달(6칸) 10/21/18/11/22/18, 검색(7칸) 16/9/17/15/9/22/12
  const widths = showTeam ? [16, 9, 17, 15, 9, 22, 12] : [10, 21, 18, 11, 22, 18];
  return (
    <div className={scrollY ? "tv-table-wrap" : undefined}>
      <table className="tv-table">
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {showTeam && <th>소속</th>}
            <th>번호</th>
            <th>선수명</th>
            <th>포지션</th>
            <th>학년</th>
            <th>신장/체중</th>
            <th>투타</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const pos = getPos(p);
            return (
              <tr
                key={`${p.person_no || p.name}-${i}`}
                style={{ cursor: p.person_no ? "pointer" : "default" }}
                onClick={() => p.person_no && onOpen(p)}
              >
                {showTeam && <td>{p.team}</td>}
                <td>{p.number || "-"}</td>
                <td className="tv-name">
                  {p.name}
                  {p.person_no && <span className="muted" aria-hidden> ›</span>}
                </td>
                <td>
                  <span className="pos-badge" style={{ background: POS_COLORS[pos] ?? "#9AA0A6" }}>
                    {pos}
                  </span>
                </td>
                <td>
                  {p.grade ? (
                    <span className="grade-badge" style={{ background: GRADE_COLORS[p.grade] ?? "#9AA0A6" }}>
                      {p.grade}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{p.height_weight || "-"}</td>
                <td>{p.throw_bat || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PLAYER_ROWS_PER_PAGE = 10;

function PagedPlayerTable({
  rows, showTeam, onOpen,
}: {
  rows: TeamPlayerEntry[];
  showTeam?: boolean;
  onOpen: (p: TeamPlayerEntry) => void;
}) {
  const pages = Array.from(
    { length: Math.ceil(rows.length / PLAYER_ROWS_PER_PAGE) },
    (_, i) => rows.slice(i * PLAYER_ROWS_PER_PAGE, (i + 1) * PLAYER_ROWS_PER_PAGE)
  );
  return (
    <PagedCardGrid perPage={1} layout="single" hint="← 옆으로 넘겨 다음 선수">
      {pages.map((page, i) => (
        <PlayerTable key={i} rows={page} showTeam={showTeam} onOpen={onOpen} />
      ))}
    </PagedCardGrid>
  );
}

type StaffRow = TeamStaffEntry & { team: string };

function PagedStaffTable({ rows }: { rows: StaffRow[] }) {
  const pages = Array.from(
    { length: Math.ceil(rows.length / PLAYER_ROWS_PER_PAGE) },
    (_, i) => rows.slice(i * PLAYER_ROWS_PER_PAGE, (i + 1) * PLAYER_ROWS_PER_PAGE)
  );
  return (
    <PagedCardGrid perPage={1} layout="single" hint="← 옆으로 넘겨 다음 지도자">
      {pages.map((page, i) => (
        <table className="tv-table tv-staff-table" key={i}>
          <thead><tr><th>소속</th><th>역할</th><th>이름</th></tr></thead>
          <tbody>
            {page.map((s, j) => (
              <tr key={`${s.person_no || s.name}-${j}`}>
                <td>{s.team}</td><td>{s.role || "지도자"}</td>
                <td className="tv-name">
                  {s.person_no ? (
                    <a href={kbsaPlayerUrl(s.person_no, "T")} target="_blank" rel="noreferrer">{s.name} ↗</a>
                  ) : s.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </PagedCardGrid>
  );
}

type StatList = "staff" | "미지정" | "투수" | "포수" | "내야수" | "외야수";

export function TeamsView({ wrapClass }: { wrapClass: string }) {
  const { data: teams, loading } = useTeams();
  const { data: index } = usePlayerIndex();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [region, setRegion] = useState("");
  const [grade, setGrade] = useState("");
  const [searchType, setSearchType] = useState<"team" | "name" | "number">("team");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState(""); // 실행된 검색어 (검색 버튼/엔터 시 반영)
  const [activeStat, setActiveStat] = useState<StatList | null>(null);
  // 팀 모달 = URL 쿼리(?team=)로 구동 — 선수 상세로 이동 후 뒤로가기 시 모달이 그대로 복원된다.
  const modalTeam = searchParams.get("team");
  const modalPos = searchParams.get("mpos") ?? "";
  const modalGrade = searchParams.get("mgrade") ?? "";

  // 기록 보유 선수: personNo → 정규 player.id (기록 상세 연결용)
  const personToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of index ?? []) if (e.personNo) m.set(e.personNo, e.id);
    return m;
  }, [index]);
  const openPlayer = (p: TeamPlayerEntry) => {
    if (!p.person_no) return;
    const id = personToId.get(p.person_no);
    // 항상 push — 선수 상세에서 뒤로가기 시 팀 모달(?team=) 상태로 복귀한다.
    nav(id ? `/player/${id}` : `/person/${p.person_no}`);
  };

  const rows = useMemo(() => teams ?? [], [teams]);
  const regions = useMemo(
    () => [...new Set(rows.map((t) => t.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")),
    [rows]
  );
  const scopedTeams = useMemo(() => {
    let list = region ? rows.filter((t) => t.region === region) : rows;
    if (grade) list = list.filter((t) => t.players.some((p) => getGrade(p) === grade));
    return list;
  }, [rows, region, grade]);
  const scopedPlayers = useMemo(
    () => scopedTeams.flatMap((t) => grade ? t.players.filter((p) => getGrade(p) === grade) : t.players),
    [scopedTeams, grade]
  );
  const posCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of scopedPlayers) m.set(getPos(p), (m.get(getPos(p)) ?? 0) + 1);
    return m;
  }, [scopedPlayers]);
  const staffRows = useMemo<StaffRow[]>(
    () => scopedTeams.flatMap((t) => t.staff.map((s) => ({ ...s, team: t.team }))),
    [scopedTeams]
  );
  const totalStaff = staffRows.length;
  const statPlayers = useMemo(
    () => activeStat && activeStat !== "staff"
      ? scopedPlayers.filter((p) => getPos(p) === activeStat)
      : [],
    [activeStat, scopedPlayers]
  );

  // 팀 카드 필터 (지역 + 팀명 검색)
  const filteredTeams = useMemo(() => {
    let list = scopedTeams;
    if (query && searchType === "team") {
      const q = query.toLowerCase();
      list = list.filter((t) => t.team.toLowerCase().includes(q));
    }
    return list;
  }, [scopedTeams, query, searchType]);

  // 이름/백넘버 검색 결과 (선수 테이블)
  const searchResults = useMemo(() => {
    if (!query || searchType === "team") return null;
    let list =
      searchType === "name"
        ? scopedPlayers.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        : scopedPlayers.filter((p) => p.number === query);
    return list;
  }, [query, searchType, scopedPlayers]);

  // ===== 팀 상세 모달 =====
  const modalInfo = modalTeam ? rows.find((t) => t.team === modalTeam) ?? null : null;
  const modalPlayers = useMemo(() => {
    if (!modalInfo) return [];
    let list = modalInfo.players;
    if (modalPos) list = list.filter((p) => getPos(p) === modalPos);
    if (modalGrade) list = list.filter((p) => getGrade(p) === modalGrade);
    return [...list].sort((a, b) => (parseInt(a.number, 10) || 999) - (parseInt(b.number, 10) || 999));
  }, [modalInfo, modalPos, modalGrade]);
  const openTeam = (team: string) => {
    // 히스토리에 엔트리를 쌓아 연다 — 뒤로가기로 닫히고, 선수 상세에서 복귀 시 재오픈된다.
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("team", team);
      p.delete("mpos");
      p.delete("mgrade");
      return p;
    });
  };
  const replaceModalFilters = (pos: string, modalGradeValue: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (pos) p.set("mpos", pos); else p.delete("mpos");
      if (modalGradeValue) p.set("mgrade", modalGradeValue); else p.delete("mgrade");
      return p;
    }, { replace: true });
  };
  // UI 닫기(X·배경·ESC): 열 때 쌓은 엔트리를 뒤로가기로 소거. 직접 진입 등 뒤로 갈 곳이
  // 없으면(idx 0) 파라미터만 제거해 사이트 이탈을 막는다.
  const closeModal = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      nav(-1);
    } else {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete("team");
          p.delete("mpos");
          p.delete("mgrade");
          return p;
        },
        { replace: true }
      );
    }
  }, [nav, setSearchParams]);
  useEffect(() => {
    if (!modalTeam) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalTeam, closeModal]);

  if (loading) return <div className={wrapClass}><div className="state">불러오는 중…</div></div>;
  if (!teams) {
    return (
      <div className={wrapClass}>
        <h2 className="heading-xl"><Ico name="players" variant="title" />선수현황</h2>
        <div className="state">선수현황 데이터가 아직 없습니다.</div>
      </div>
    );
  }

  const doSearch = () => {
    setActiveStat(null);
    setQuery(input.trim());
  };
  const resetSearch = () => {
    setInput("");
    setQuery("");
  };
  const toggleStat = (stat: StatList) => {
    const next = activeStat === stat ? null : stat;
    setActiveStat(next);
    if (next) {
      setInput("");
      setQuery("");
    }
  };

  const modalPosCounts = (() => {
    const m = new Map<string, number>();
    for (const p of modalInfo?.players ?? []) m.set(getPos(p), (m.get(getPos(p)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => POS_ORDER.indexOf(a[0]) - POS_ORDER.indexOf(b[0]));
  })();
  const modalGradeCounts = (() => {
    const m = new Map<string, number>();
    for (const p of modalInfo?.players ?? []) m.set(getGrade(p), (m.get(getGrade(p)) ?? 0) + 1);
    return [...m.entries()].sort();
  })();

  return (
    <div className={wrapClass}>
      <h2 className="heading-xl"><Ico name="players" variant="title" />선수현황</h2>
      <p className="caption" style={{ margin: "4px 0 16px" }}>
        18세 이하부 전체 등록 선수 · 출처 korea-baseball.com (KBSA)
      </p>

      {/* 통계 밴드: 팀/선수/지도자/포지션별 인원 */}
      <div className="tv-stats">
        <div className="cell"><b>{scopedTeams.length}</b><span>팀</span></div>
        <div className="cell"><b>{scopedPlayers.length.toLocaleString()}</b><span>선수</span></div>
        <button type="button" className={`cell tv-stat-button${activeStat === "staff" ? " is-active" : ""}`} onClick={() => toggleStat("staff")}>
          <b>{totalStaff}</b><span>지도자</span>
        </button>
        {(["미지정", "투수", "포수", "내야수", "외야수"] as const).map((pos) => (
          <button type="button" key={pos} className={`cell tv-stat-button${activeStat === pos ? " is-active" : ""}`} onClick={() => toggleStat(pos)}>
            <b>{(posCounts.get(pos) ?? 0).toLocaleString()}</b><span>{pos}</span>
          </button>
        ))}
      </div>

      {/* 필터: 지역 + 학년 + 검색(팀명/이름/백넘버) */}
      <div className="filter-bar">
        <div className="filter-bar__row filter-bar__row--3col">
          <select className="m-select" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">지역 전체</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select className="m-select" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="학년 선택">
            <option value="">학년 전체</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
          <select
            className="m-select"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as typeof searchType)}
          >
            <option value="team">팀명</option>
            <option value="name">이름</option>
            <option value="number">백넘버</option>
          </select>
        </div>
        <div className="filter-bar__row">
          <form
            className="search-pill"
            style={{ flex: 1, minWidth: 160 }}
            onSubmit={(e) => { e.preventDefault(); doSearch(); }}
          >
            <span aria-hidden>⌕</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="검색어 입력"
              aria-label="검색어 입력"
            />
          </form>
          <button className="btn btn--primary btn--sm" onClick={doSearch}>검색</button>
          <button className="btn btn--secondary btn--sm" onClick={resetSearch}>초기화</button>
        </div>
      </div>

      {activeStat ? (
        <section className="tv-stat-list" aria-label={`${activeStat === "staff" ? "지도자" : activeStat} 목록`}>
          <div className="tv-stat-list__head">
            <h3 className="tv-sec-title">{activeStat === "staff" ? "지도자" : activeStat} 목록</h3>
            <span className="caption-sm">{activeStat === "staff" ? staffRows.length : statPlayers.length}명</span>
          </div>
          {activeStat === "staff" ? (
            staffRows.length ? <PagedStaffTable rows={staffRows} /> : <div className="state">해당 지도자가 없습니다.</div>
          ) : statPlayers.length ? (
            <PagedPlayerTable rows={statPlayers} showTeam onOpen={openPlayer} />
          ) : (
            <div className="state">해당 선수가 없습니다.</div>
          )}
        </section>
      ) : searchResults ? (
        <>
          <p className="caption-sm" style={{ margin: "0 0 10px" }}>
            “{query}” 검색 결과 {searchResults.length}명
          </p>
          {searchResults.length === 0 ? (
            <div className="state">검색 결과가 없습니다.</div>
          ) : (
            <PagedPlayerTable rows={searchResults} showTeam onOpen={openPlayer} />
          )}
        </>
      ) : (
        <>
          <p className="caption-sm" style={{ margin: "0 0 10px" }}>
            {query && searchType === "team" ? `“${query}” 검색 결과 ` : ""}
            {filteredTeams.length}개 팀
          </p>
          <PagedCardGrid perPage={8} compact>
            {filteredTeams.map((t) => (
              <button key={t.club_idx} className="sch-team-card" onClick={() => openTeam(t.team)}>
                <div className="sch-team-card__head">
                  <h3>{t.team}</h3>
                  {t.region && <span className="sch-team-card__reg">{t.region}</span>}
                </div>
                <div className="tv-team-card__body">
                  <div className="row"><span>감독</span><b>{t.manager || "-"}</b></div>
                  <div className="row"><span>선수</span><b>{(grade ? t.players.filter((p) => getGrade(p) === grade).length : t.players.length)}명</b></div>
                  <div className="row"><span>지도자</span><b>{t.staff.length}명</b></div>
                </div>
              </button>
            ))}
          </PagedCardGrid>
          {filteredTeams.length === 0 && <div className="state">검색 결과가 없습니다.</div>}
        </>
      )}

      {/* 팀 상세 모달 */}
      {modalInfo && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal-card modal-card--wide">
            <div className="modal-head modal-head--team">
              <h3>
                <span className="modal-abbr" style={{ fontSize: 18 }}>{modalInfo.team}</span>
                {modalInfo.region && <span className="modal-name">{modalInfo.region}</span>}
              </h3>
              <button className="icon-btn" onClick={closeModal} aria-label="닫기">✕</button>
            </div>
            <div className="sch-modal-body">
              {modalInfo.staff.length > 0 && (
                <section style={{ marginBottom: 14 }}>
                  <h4 className="tv-sec-title">지도자 ({modalInfo.staff.length}명)</h4>
                  <div className="tv-staff">
                    {modalInfo.staff.map((s, i) => (
                      <span key={`${s.person_no || s.name}-${i}`} className="tv-staff__chip">
                        <span className="muted">{s.role || "지도자"}</span>{" "}
                        {s.person_no ? (
                          <a href={kbsaPlayerUrl(s.person_no, "T")} target="_blank" rel="noreferrer">
                            {s.name} ↗
                          </a>
                        ) : (
                          s.name
                        )}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 포지션/학년 필터 (클릭 토글 — 원본 색상 아웃라인 버튼, 한 줄 균등 배치) */}
              <div className="tv-filter-row">
                {modalPosCounts.map(([pos, cnt]) => (
                  <ColorChip
                    key={pos}
                    color={POS_COLORS[pos] ?? "#9AA0A6"}
                    active={modalPos === pos}
                    onClick={() => replaceModalFilters(modalPos === pos ? "" : pos, modalGrade)}
                  >
                    {pos} <span className="cnt">{cnt}명</span>
                  </ColorChip>
                ))}
              </div>
              <div className="tv-filter-row">
                {modalGradeCounts.map(([g, cnt]) => (
                  <ColorChip
                    key={g}
                    color={GRADE_COLORS[g] ?? "#9AA0A6"}
                    active={modalGrade === g}
                    onClick={() => replaceModalFilters(modalPos, modalGrade === g ? "" : g)}
                  >
                    {g === "미지정" ? "미지정" : `${g}학년`} <span className="cnt">{cnt}명</span>
                  </ColorChip>
                ))}
                {(modalPos || modalGrade) && (
                  <button
                    type="button"
                    className="chip tv-color-chip"
                    onClick={() => replaceModalFilters("", "")}
                  >
                    초기화
                  </button>
                )}
              </div>
              <p className="caption-sm" style={{ margin: "0 0 8px" }}>
                {modalPos || modalGrade
                  ? `필터: ${[modalPos, modalGrade && (modalGrade === "미지정" ? "미지정" : `${modalGrade}학년`)].filter(Boolean).join(" + ")} — ${modalPlayers.length}명`
                  : `전체 ${modalPlayers.length}명`}
              </p>

              <PlayerTable rows={modalPlayers} scrollY onOpen={openPlayer} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
