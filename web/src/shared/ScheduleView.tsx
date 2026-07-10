// 경기일정 화면 (데스크탑/모바일 공용) — 월별 달력 / 학교별 / 시합별(순위표·대진).
// 페이지 구성은 u81-baseball/generate_schedule.py 의 u18_schedule.html 과 동일,
// 스타일만 이 저장소의 디자인 토큰(Nike.md)을 따른다.
import { useEffect, useMemo, useState } from "react";
import { useSchedule, useTeams } from "./data";
import { Chip } from "../design/ui";
import { kbsaBoxScoreUrl } from "./kbsa";
import type { ScheduleGame, ScheduleSide } from "./types";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDateHeader = (d: string) => {
  const dt = new Date(`${d}T00:00:00`);
  return `${dt.getMonth() + 1}/${dt.getDate()} (${WD[dt.getDay()]})`;
};
// 카드용 짧은 대회명: 맨 앞 연도만 제거 (청룡기·황금사자기 등 이름은 유지)
const shortTitle = (t: string) => (t || "").replace(/^\s*\d{4}\s*/, "").trim();
// 주말리그 = 제목에 '주말리그 전반기/후반기' 포함 / 전국대회 = 그 외
const isLeague = (t: string) => /주말리그\s*(전반기|후반기)/.test(t || "");
const leaguePhase = (t: string) => (t || "").match(/주말리그\s*(전반기|후반기)/)?.[1] ?? "";
const leagueRegion = (t: string) => (t || "").match(/\(([^)]+)\)\s*$/)?.[1] ?? (t || "");
// 전국대회 짧은 표기: 핵심 대회명은 유지, 장황한 수식어 제거
const cupLabel = (t: string) =>
  (t || "")
    .replace(/^\s*\d{4}\s*/, "")
    .replace(/\s*겸\s*주말리그\s*왕중왕전/, "")
    .replace(/전국고교야구선수권대회/, "")
    .replace(/전국고교야구대회/, "")
    .replace(/\s+/g, " ")
    .trim();
const compLabel = (t: string) => (isLeague(t) ? shortTitle(t) : cupLabel(t));

// 토너먼트 라운드 정렬 우선순위 (작을수록 상위: 결승 먼저)
const ROUND_RANK: Record<string, number> = {
  결승전: 1, 결승: 1, 준결승전: 2, 준결승: 2, "4강전": 2, "8강전": 3, "8강": 3,
  "16강전": 4, "16강": 4, "32강전": 5, "32강": 5, "64강전": 6,
  "2회전": 7, "1회전": 8, 예선전: 9, 예선: 9, 리그전: 9,
};
const roundRank = (r: string) => ROUND_RANK[(r || "").trim()] ?? 50;

// 경기 한 건에서 팀 me의 승/패/무 판정 (result 우선, 없으면 점수)
function outcome(me: ScheduleSide, opp: ScheduleSide): "w" | "l" | "d" | null {
  if (me.result === "승") return "w";
  if (me.result === "패") return "l";
  if (me.result === "무") return "d";
  if (me.score != null && opp.score != null) {
    if (me.score > opp.score) return "w";
    if (me.score < opp.score) return "l";
    return "d";
  }
  return null;
}

interface StandRow {
  name: string; played: number; w: number; l: number; d: number;
  rf: number; ra: number; pts: number;
}

// 시합별 순위표 (승점 → 협회 공식 순위 우선, 폴백 = 승자승 미니리그)
function compStandings(games: ScheduleGame[], title: string, officialRanks?: Record<string, string[]>) {
  const done = games.filter((g) => g.title === title && g.status === "완료");
  const T = new Map<string, StandRow>();
  const ensure = (n: string): StandRow => {
    let t = T.get(n);
    if (!t) { t = { name: n, played: 0, w: 0, l: 0, d: 0, rf: 0, ra: 0, pts: 0 }; T.set(n, t); }
    return t;
  };
  for (const g of done) {
    const a = g.away, h = g.home;
    if (!a.name || !h.name) continue;
    const oa = outcome(a, h), oh = outcome(h, a);
    if (!oa || !oh) continue;
    const ta = ensure(a.name), th = ensure(h.name);
    ta.played++; th.played++;
    if (oa === "w") ta.w++; else if (oa === "l") ta.l++; else ta.d++;
    if (oh === "w") th.w++; else if (oh === "l") th.l++; else th.d++;
    if (a.score != null && h.score != null) {
      ta.rf += a.score; ta.ra += h.score; th.rf += h.score; th.ra += a.score;
    }
  }
  const arr = [...T.values()];
  for (const t of arr) t.pts = t.w * 2 + t.d; // 승점: 승2 / 무1 / 패0

  // 협회 공식 순위(전적표)가 있으면 그 순서를 그대로 사용
  const off = officialRanks?.[title];
  if (off?.length) {
    const oidx = new Map(off.map((n, k) => [n, k]));
    if (arr.every((t) => oidx.has(t.name))) {
      arr.sort((a, b) => oidx.get(a.name)! - oidx.get(b.name)!);
      return { rows: arr, official: true };
    }
  }

  // (폴백) 동률(승점) 팀들 간 미니리그 집계 (승자승 → 실점 → 득점)
  const mini = (group: StandRow[]) => {
    const set = new Set(group.map((t) => t.name));
    const m = new Map(group.map((t) => [t.name, { pts: 0, ra: 0, rf: 0 }]));
    for (const g of done) {
      const a = g.away, h = g.home;
      if (!set.has(a.name) || !set.has(h.name)) continue;
      const oa = outcome(a, h), oh = outcome(h, a);
      if (!oa || !oh) continue;
      if (oa === "w") m.get(a.name)!.pts += 2; else if (oa === "d") m.get(a.name)!.pts++;
      if (oh === "w") m.get(h.name)!.pts += 2; else if (oh === "d") m.get(h.name)!.pts++;
    }
    return m;
  };
  arr.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, "ko"));
  const res: StandRow[] = [];
  let i = 0;
  while (i < arr.length) {
    let j = i;
    while (j < arr.length && arr[j].pts === arr[i].pts) j++;
    const group = arr.slice(i, j);
    if (group.length > 1) {
      const m = mini(group);
      group.sort(
        (a, b) =>
          m.get(b.name)!.pts - m.get(a.name)!.pts || // 승자승(맞대결 승점)
          a.ra - b.ra ||                             // 전체 실점 적은 순
          b.rf - a.rf ||                             // 전체 득점 많은 순
          a.name.localeCompare(b.name, "ko")
      );
    }
    res.push(...group);
    i = j;
  }
  return { rows: res, official: false };
}

// 경기 카드 (원본 gameCard 이식 — 클릭 시 KBSA 박스스코어 새 탭)
function GameCard({ g, hideComp }: { g: ScheduleGame; hideComp?: boolean }) {
  const a = g.away, h = g.home;
  const done = g.status === "완료";
  const cls = (side: ScheduleSide) =>
    side.result === "승" ? "win" : done ? "lose" : "";
  const stage = g.round || (g.status === "예정" ? "예정" : g.status === "취소" ? "취소" : "");
  // 단계 칩 색: 토너먼트(결승/강 등)=cup, 리그/예선=league, 예정=sched (원본 stageCls 이식)
  const stageCls = g.round
    ? /결승|준결|[0-9]+강|왕중왕|플레이오프|토너/.test(g.round) ? "cup" : "league"
    : g.status === "취소" ? "cup" : "sched";
  const metaLeft = [
    g.status === "예정" ? "예정" : g.status === "취소" ? "취소" : "",
    g.time,
    g.venue,
  ].filter(Boolean).join(" · ");
  return (
    <a className="sch-game" href={kbsaBoxScoreUrl(g.game_idx)} target="_blank" rel="noreferrer">
      <div className="sch-game__top">
        <span className="sch-game__comp">{!hideComp && g.title ? shortTitle(g.title) : ""}</span>
        {stage && <span className={`sch-game__stage sch-game__stage--${stageCls}`}>{stage}</span>}
      </div>
      <div className="sch-game__score">
        <span className={`sch-side ${cls(a)}`}>
          <span className="nm">{a.name}</span>
          <span className="sc">{a.score == null ? "-" : a.score}</span>
          {a.result && <span className="rb">{a.result}</span>}
        </span>
        <span className="sch-game__colon">:</span>
        <span className={`sch-side ${cls(h)}`}>
          {h.result && <span className="rb">{h.result}</span>}
          <span className="sc">{h.score == null ? "-" : h.score}</span>
          <span className="nm">{h.name}</span>
        </span>
      </div>
      <div className="sch-game__meta">
        <span>{metaLeft}</span>
        <span className="muted">기록 ›</span>
      </div>
    </a>
  );
}

type ModalState =
  | { type: "date"; ds: string }
  | { type: "team"; name: string; compTitle?: string }
  | null;

function Modal({ title, sub, onClose, children }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-card--wide">
        <div className="modal-head">
          <h3>
            <span className="modal-abbr" style={{ fontSize: 18 }}>{title}</span>
            {sub && <span className="modal-name">{sub}</span>}
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ScheduleView({ wrapClass }: { wrapClass: string }) {
  const { data: sched, loading } = useSchedule();
  const { data: teamRows } = useTeams();
  const [view, setView] = useState<"month" | "team" | "comp">("month");
  const [monthIdx, setMonthIdx] = useState<number | null>(null);
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const [compType, setCompType] = useState<"league" | "cup">("league");
  const [phase, setPhase] = useState("후반기");
  const [comp, setComp] = useState("");
  const [round, setRound] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const games = useMemo(() => sched?.games ?? [], [sched]);
  // 팀 → 지역 매핑 (선수현황 데이터)
  const teamRegion = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teamRows ?? []) if (t.team && t.region) m.set(t.team, t.region);
    return m;
  }, [teamRows]);

  // ===== 월별 달력 =====
  const months = useMemo(
    () => [...new Set(games.filter((g) => g.date).map((g) => g.date.slice(0, 7)))].sort(),
    [games]
  );
  // 초기 월 = 오늘이 속한 월(없으면 다음 월, 그것도 없으면 마지막 월)
  const curMonthIdx = useMemo(() => {
    if (monthIdx != null) return Math.max(0, Math.min(months.length - 1, monthIdx));
    const today = new Date().toISOString().slice(0, 7);
    let idx = months.indexOf(today);
    if (idx < 0) idx = months.findIndex((m) => m >= today);
    if (idx < 0) idx = months.length - 1;
    return Math.max(0, idx);
  }, [monthIdx, months]);

  // ===== 학교별 =====
  const teams = useMemo(
    () =>
      [...new Set(games.flatMap((g) => [g.away.name, g.home.name]))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ko")),
    [games]
  );
  const teamRecord = useMemo(() => {
    const rec = new Map<string, { played: number; w: number; l: number }>();
    for (const t of teams) rec.set(t, { played: 0, w: 0, l: 0 });
    for (const g of games) {
      if (g.status !== "완료") continue;
      for (const side of [g.away, g.home]) {
        const r = rec.get(side.name);
        if (!r) continue;
        r.played++;
        if (side.result === "승") r.w++;
        else if (side.result === "패") r.l++;
      }
    }
    return rec;
  }, [games, teams]);
  const regions = useMemo(
    () =>
      [...new Set(teams.map((t) => teamRegion.get(t)).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b, "ko")
      ),
    [teams, teamRegion]
  );
  const filteredTeams = useMemo(() => {
    let list = teams;
    if (region) list = list.filter((t) => teamRegion.get(t) === region);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((t) => t.toLowerCase().includes(q));
    return list;
  }, [teams, region, query, teamRegion]);

  // ===== 시합별 =====
  const comps = useMemo(
    () => [...new Set(games.map((g) => g.title).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")),
    [games]
  );
  const leagueComps = useMemo(() => comps.filter(isLeague), [comps]);
  const cupComps = useMemo(() => comps.filter((c) => !isLeague(c)), [comps]);
  const compOptions = useMemo(() => {
    if (compType === "league") {
      return leagueComps
        .filter((c) => leaguePhase(c) === phase)
        .map((c) => ({ v: c, label: leagueRegion(c) }))
        .sort((a, b) => a.label.localeCompare(b.label, "ko"));
    }
    return cupComps.map((c) => ({ v: c, label: cupLabel(c) }));
  }, [compType, phase, leagueComps, cupComps]);
  // 시합 유형/전후반 변경 시 선택 초기화
  useEffect(() => {
    setComp("");
    setRound("");
  }, [compType, phase]);
  const rounds = useMemo(() => {
    if (!comp || isLeague(comp)) return [];
    return [...new Set(games.filter((g) => g.title === comp).map((g) => g.round).filter(Boolean))]
      .sort((a, b) => roundRank(b) - roundRank(a)); // 예선전 → 결승전
  }, [comp, games]);

  const standings = useMemo(
    () => (comp && isLeague(comp) ? compStandings(games, comp, sched?.official_ranks) : null),
    [comp, games, sched?.official_ranks]
  );
  const bracketList = useMemo(() => {
    if (!comp || isLeague(comp)) return [];
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const T0 = t0.getTime();
    const dayTs = (d: string) => (d ? new Date(`${d}T00:00:00`).getTime() : Infinity);
    const prio = (g: ScheduleGame) => { const t = dayTs(g.date); return t === T0 ? 0 : t > T0 ? 1 : 2; };
    // 정렬: 오늘 → 이후 일정(날짜 오름차순) → 지난 경기(최근 날짜부터)
    return games
      .filter((g) => g.title === comp && (!round || g.round === round))
      .sort((x, y) => {
        const p = prio(x) - prio(y);
        if (p) return p;
        const tx = dayTs(x.date), ty = dayTs(y.date);
        if (tx !== ty) return prio(x) === 2 ? ty - tx : tx - ty;
        const tt = (x.time || "").localeCompare(y.time || "");
        if (tt) return tt;
        return roundRank(x.round) - roundRank(y.round);
      });
  }, [comp, round, games]);

  if (loading) return <div className={wrapClass}><div className="state">불러오는 중…</div></div>;
  if (!sched) {
    return (
      <div className={wrapClass}>
        <h2 className="heading-xl">경기일정</h2>
        <div className="state">일정 데이터가 아직 없습니다.</div>
      </div>
    );
  }

  const ym = months[curMonthIdx] ?? "";
  const renderCalendar = () => {
    if (!ym) return <div className="state">경기가 없습니다.</div>;
    const [y, m] = ym.split("-").map(Number);
    const firstWd = new Date(y, m - 1, 1).getDay();
    const daysIn = new Date(y, m, 0).getDate();
    const counts = new Map<string, number>();
    for (const g of games) {
      if (g.date?.slice(0, 7) === ym) counts.set(g.date, (counts.get(g.date) ?? 0) + 1);
    }
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < firstWd; i++) cells.push(<div key={`e${i}`} className="sch-cal__day sch-cal__day--empty" />);
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const n = counts.get(ds) ?? 0;
      cells.push(
        n ? (
          <button key={ds} className="sch-cal__day sch-cal__day--has" onClick={() => setModal({ type: "date", ds })}>
            {d}
            <span className="cnt">{n}</span>
          </button>
        ) : (
          <div key={ds} className="sch-cal__day">{d}</div>
        )
      );
    }
    return (
      <>
        <div className="sch-monthnav">
          <button className="sch-monthnav__btn" disabled={curMonthIdx <= 0} onClick={() => setMonthIdx(curMonthIdx - 1)} aria-label="이전 달">‹</button>
          <span className="sch-monthnav__cur">{ym.replace("-", ". ")}</span>
          <button className="sch-monthnav__btn" disabled={curMonthIdx >= months.length - 1} onClick={() => setMonthIdx(curMonthIdx + 1)} aria-label="다음 달">›</button>
        </div>
        <div className="sch-cal">
          <div className="sch-cal__wd">
            {WD.map((w, i) => (
              <div key={w} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>{w}</div>
            ))}
          </div>
          <div className="sch-cal__grid">{cells}</div>
        </div>
      </>
    );
  };

  const teamCard = (name: string) => {
    const r = teamRecord.get(name) ?? { played: 0, w: 0, l: 0 };
    const reg = teamRegion.get(name);
    return (
      <button key={name} className="sch-team-card" onClick={() => setModal({ type: "team", name })}>
        <div className="sch-team-card__head">
          <h3>{name}</h3>
          {reg && <span className="sch-team-card__reg">{reg}</span>}
        </div>
        <div className="sch-team-card__body">
          <div className="rc"><b>{r.played}</b><span>경기</span></div>
          <div className="rc"><b className="wv">{r.w}</b><span>승</span></div>
          <div className="rc"><b className="lv">{r.l}</b><span>패</span></div>
        </div>
      </button>
    );
  };

  // ===== 모달 콘텐츠 =====
  const renderDateModal = (ds: string) => {
    // 대회(전체이름)별로 묶고, 그 안에서 시간순
    const list = games
      .filter((g) => g.date === ds)
      .sort(
        (x, y) => (x.title || "").localeCompare(y.title || "") || (x.time || "").localeCompare(y.time || "")
      );
    let lastT: string | null = null;
    return (
      <Modal title={fmtDateHeader(ds)} sub={`${list.length}경기`} onClose={() => setModal(null)}>
        <div className="sch-modal-body">
          {list.length === 0 && <div className="state">경기가 없습니다.</div>}
          {list.map((g) => {
            const t = g.title || "기타";
            const head = t !== lastT ? <div className="sch-group">{t}</div> : null;
            lastT = t;
            return (
              <div key={g.game_idx}>
                {head}
                <GameCard g={g} hideComp />
              </div>
            );
          })}
        </div>
      </Modal>
    );
  };

  const renderTeamModal = (name: string, compTitle?: string) => {
    let list = games.filter((g) => g.away.name === name || g.home.name === name);
    if (compTitle) list = list.filter((g) => g.title === compTitle);
    list = [...list].sort((x, y) => (y.date + (y.time || "")).localeCompare(x.date + (x.time || "")));
    let w = 0, l = 0, d = 0, played = 0;
    for (const g of list) {
      if (g.status !== "완료") continue;
      played++;
      const me = g.away.name === name ? g.away : g.home;
      if (me.result === "승") w++;
      else if (me.result === "패") l++;
      else if (me.result === "무") d++;
    }
    let lastDate = "";
    return (
      <Modal
        title={name}
        sub={compTitle ? shortTitle(compTitle) : teamRegion.get(name)}
        onClose={() => setModal(null)}
      >
        <div className="sch-modal-body">
          <div className="sch-rec">
            <div className="rc"><b>{played}</b><span>경기</span></div>
            <div className="rc"><b className="wv">{w}</b><span>승</span></div>
            <div className="rc"><b className="lv">{l}</b><span>패</span></div>
            {d > 0 && <div className="rc"><b>{d}</b><span>무</span></div>}
          </div>
          {list.map((g) => {
            const head = g.date !== lastDate ? <div className="sch-group">{fmtDateHeader(g.date)}</div> : null;
            lastDate = g.date;
            return (
              <div key={g.game_idx}>
                {head}
                <GameCard g={g} />
              </div>
            );
          })}
          {list.length === 0 && <div className="state">경기가 없습니다.</div>}
        </div>
      </Modal>
    );
  };

  const hasD = standings?.rows.some((r) => r.d > 0) ?? false;
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  return (
    <div className={wrapClass}>
      <div className="section-head">
        <h2 className="heading-xl">경기일정</h2>
        <span className="caption">갱신 {sched.updated}</span>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <Chip active={view === "month"} onClick={() => setView("month")}>월별 일정</Chip>
        <Chip active={view === "team"} onClick={() => setView("team")}>학교</Chip>
        <Chip active={view === "comp"} onClick={() => setView("comp")}>시합</Chip>
      </div>

      {view === "month" && renderCalendar()}

      {view === "team" && (
        <>
          <div className="filter-bar">
            <div className="filter-bar__row">
              <select className="m-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">지역 전체</option>
                {regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <div className="search-pill" style={{ flex: 1, minWidth: 160 }}>
                <span aria-hidden>⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="학교명 검색"
                  aria-label="학교명 검색"
                />
              </div>
            </div>
          </div>
          <p className="caption-sm" style={{ margin: "0 0 10px" }}>{filteredTeams.length}개 학교</p>
          <div className="sch-team-grid">
            {filteredTeams.map(teamCard)}
            {filteredTeams.length === 0 && <div className="state">검색 결과가 없습니다.</div>}
          </div>
        </>
      )}

      {view === "comp" && (
        <>
          <div className="tabs sch-seg" style={{ marginBottom: 8 }}>
            <Chip active={compType === "league"} onClick={() => setCompType("league")}>주말리그</Chip>
            <Chip active={compType === "cup"} onClick={() => setCompType("cup")}>전국대회</Chip>
          </div>
          {compType === "league" && (
            <div className="tabs sch-seg" style={{ marginBottom: 8 }}>
              <Chip active={phase === "전반기"} onClick={() => setPhase("전반기")}>전반기</Chip>
              <Chip active={phase === "후반기"} onClick={() => setPhase("후반기")}>후반기</Chip>
            </div>
          )}
          <div className="filter-bar">
            <div className="filter-bar__row">
              <select
                className="m-select"
                value={comp}
                onChange={(e) => { setComp(e.target.value); setRound(""); }}
              >
                <option value="">{compType === "league" ? "권역 선택" : "대회 선택"}</option>
                {compOptions.map((o) => (
                  <option key={o.v} value={o.v}>{o.label}</option>
                ))}
              </select>
              {comp && !isLeague(comp) && rounds.length > 0 && (
                <select className="m-select" value={round} onChange={(e) => setRound(e.target.value)}>
                  <option value="">전체</option>
                  {rounds.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {!comp && <div className="state">위에서 시합을 선택하면 순위·경기가 표시됩니다.</div>}

          {comp && standings && (
            <>
              <h3 className="heading-md" style={{ margin: "8px 0 2px" }}>{compLabel(comp)}</h3>
              <p className="caption-sm" style={{ margin: "0 0 10px" }}>
                {standings.official
                  ? "순위: 대한야구소프트볼협회 공식 순위(전적표) 기준"
                  : "순위: 승점(승 2 · 무 1 · 패 0) → 승자승(맞대결) → 전체 실점 → 전체 득점"}
              </p>
              {standings.rows.length === 0 ? (
                <div className="state">완료된 경기가 없습니다.</div>
              ) : (
                <table className="tv-table sch-stand">
                  <colgroup>
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "25%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th style={{ textAlign: "left" }}>학교</th>
                      <th>경기</th>
                      <th>승</th>
                      <th>패</th>
                      {hasD && <th>무</th>}
                      <th>승점</th>
                      <th>실점</th>
                      <th>득점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.rows.map((r, i) => (
                      <tr
                        key={r.name}
                        style={{ cursor: "pointer" }}
                        onClick={() => setModal({ type: "team", name: r.name, compTitle: comp })}
                      >
                        <td className="num">{i + 1}</td>
                        <td className="nm-cell"><b>{r.name}</b></td>
                        <td className="num">{r.played}</td>
                        <td className="num">{r.w}</td>
                        <td className="num">{r.l}</td>
                        {hasD && <td className="num">{r.d}</td>}
                        <td className="num"><b>{r.pts}</b></td>
                        <td className="num">{r.ra}</td>
                        <td className="num">{r.rf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="caption-sm" style={{ marginTop: 8 }}>
                ※ 조별 편성학교는 각 학교별 1게임이 편성되어야 반영됩니다.
              </p>
            </>
          )}

          {comp && !isLeague(comp) && (
            <>
              <h3 className="heading-md" style={{ margin: "8px 0 10px" }}>{compLabel(comp)}</h3>
              {bracketList.length === 0 && <div className="state">경기가 없습니다.</div>}
              {(() => {
                let lastD: string | null = null;
                return bracketList.map((g) => {
                  const d = g.date || "";
                  const isToday = d && new Date(`${d}T00:00:00`).getTime() === today0.getTime();
                  const head =
                    d !== lastD ? (
                      <div className="sch-group sch-group--strong">
                        {d ? fmtDateHeader(d) : "일정 미정"}
                        {isToday ? " · 오늘" : ""}
                      </div>
                    ) : null;
                  lastD = d;
                  return (
                    <div key={g.game_idx}>
                      {head}
                      <GameCard g={g} hideComp />
                    </div>
                  );
                });
              })()}
            </>
          )}
        </>
      )}

      {modal?.type === "date" && renderDateModal(modal.ds)}
      {modal?.type === "team" && renderTeamModal(modal.name, modal.compTitle)}
    </div>
  );
}
