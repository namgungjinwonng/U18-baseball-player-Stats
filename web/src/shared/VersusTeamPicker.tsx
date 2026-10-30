// 매치업 학교 선택 화면 — 상단 A·B 칸, 지역·학교명 검색, 학교 카드로 두 학교를 고른 뒤 「매치업 보기」로 확정한다.
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSchedule, useTeams } from "./data";
import { Ico } from "./navIcons";
import { SearchIcon } from "./LineIcons";
import { PagedCardGrid } from "./PagedCardGrid";
import { useDevice } from "./useDevice";
import { teamKey, teamRecord } from "./versus";
import {
  activate, canConfirm, cancelParams, clearSlot, confirmParams, filterTeams, initialDraft, missingMessage, needsSelect,
  pickTeam, swapDraft, type Draft, type Slot,
} from "./versusSelect";
import { useYear } from "./year";

// A = 우리팀(분석 기준), B = 상대팀
const SLOT_LABEL: Record<Slot, string> = { a: "우리팀", b: "상대팀" };

// 상단 A·B 선택 칸 — 칸 선택 버튼과 지우기 버튼을 따로 둔다(중첩하지 않음).
function SlotBox({ slot, draft, region, onActivate, onClear }: {
  slot: Slot;
  draft: Draft;
  region: string;
  onActivate: () => void;
  onClear: () => void;
}) {
  const name = draft[slot];
  const active = draft.active === slot;
  const L = SLOT_LABEL[slot];
  return (
    <div className={`versus-slot${active ? " is-active" : ""}${name ? " is-filled" : ""}`}>
      <button
        type="button"
        className="versus-slot__main"
        aria-pressed={active}
        aria-label={`${L} ${name ? `${name}${region ? ` (${region})` : ""}` : "선택 안 됨"}${active ? ", 지금 고르는 칸" : ""}`}
        onClick={onActivate}
      >
        <span className="versus-slot__letter" aria-hidden="true">{L}</span>
        <span className="versus-slot__text" aria-hidden="true">
          <b>{name || `${L} 선택`}</b>
          <small>{name ? region || "지역 정보 없음" : active ? "아래에서 학교를 누르세요" : "눌러서 선택"}</small>
        </span>
      </button>
      {name && (
        <button type="button" className="versus-slot__clear" aria-label={`${L} ${name} 선택 지우기`} onClick={onClear}>
          ×
        </button>
      )}
    </div>
  );
}

export function VersusTeamPicker({ wrapClass }: { wrapClass: string }) {
  const compact = useDevice() === "mobile";
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const location = useLocation();
  const { year } = useYear();
  const teams = useTeams();
  const schedule = useSchedule();
  const urlA = params.get("a") ?? "";
  const urlB = params.get("b") ?? "";
  // 결과 화면의 「학교 변경」으로 들어왔으면(확정된 두 학교가 있으면) 취소로 원래 결과에 돌아갈 수 있다.
  const editing = !needsSelect(urlA, urlB, false);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(urlA, urlB));
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  // 시즌 전환 중에는 이전 시즌 목록을 보이지 않는다(로스터 scope·일정 연도 확인).
  const teamsReady = teams.scope === String(year);
  const scheduleReady = !!schedule.data && schedule.data.year === year;
  const loading = teams.loading || schedule.loading || !teamsReady || (!!schedule.data && !scheduleReady);
  const failed = !loading && !teams.data && !schedule.data;

  // 선수현황(teams.json) 학교 + 선택 시즌 일정에만 있는 학교(지역 없음)도 빠짐없이.
  const all = useMemo(() => {
    const regionOf = new Map<string, string>();
    for (const t of teamsReady ? teams.data ?? [] : []) regionOf.set(teamKey(t.team), t.region);
    const games = scheduleReady ? schedule.data!.games : [];
    for (const g of games) for (const s of [g.away, g.home]) if (!regionOf.has(teamKey(s.name))) regionOf.set(teamKey(s.name), "");
    return [...regionOf]
      .filter(([name]) => !!name)
      .map(([name, r]) => ({ name, region: r, rec: teamRecord(games, name) }))
      .sort((x, y) => x.name.localeCompare(y.name, "ko"));
  }, [teamsReady, teams.data, scheduleReady, schedule.data]);
  const regionOf = useMemo(() => new Map(all.map((t) => [t.name, t.region])), [all]);
  const regions = useMemo(
    () => [...new Set(all.map((t) => t.region).filter(Boolean))].sort((x, y) => x.localeCompare(y, "ko")),
    [all]
  );
  const filtered = useMemo(() => filterTeams(all, region, query), [all, region, query]);

  const pick = (name: string) => {
    const { draft: next, blocked } = pickTeam(draft, name);
    const other = draft.active === "a" ? "B" : "A";
    setNotice(blocked ? `${name}은(는) 이미 ${other}학교로 선택했습니다. 다른 학교를 고르세요.` : "");
    setDraft(next);
  };
  const confirm = () => {
    if (!canConfirm(draft)) return;
    const result = confirmParams(params, draft);
    // 지금 항목은 고른 상태의 선택 화면으로 바꿔 두고 결과를 쌓는다 — 결과에서 뒤로가기 시 고른 학교가 그대로 보인다.
    const picker = new URLSearchParams(result);
    picker.set("select", "1");
    nav({ search: `?${picker}` }, { replace: true, state: location.state });
    nav({ search: `?${result}` });
  };
  const cancel = () => {
    if ((location.state as { versusEdit?: boolean } | null)?.versusEdit) nav(-1);
    else setParams(cancelParams(params), { replace: true });
  };
  const missing = missingMessage(draft);
  const L = SLOT_LABEL[draft.active];

  return (
    <div className={`${wrapClass} versus-page versus-picker`}>
      <h2 className="heading-xl"><Ico name="versus" variant="title" />매치업</h2>
      <p className="caption muted versus-page__description">상대전적부터 팀 전력 비교까지</p>

      <div className={`versus-bar versus-picker__bar ${compact ? "versus-bar--compact" : ""}`}>
        <div className="versus-picker__slots">
          <SlotBox slot="a" draft={draft} region={regionOf.get(draft.a) ?? ""}
            onActivate={() => { setNotice(""); setDraft(activate(draft, "a")); }}
            onClear={() => { setNotice(""); setDraft(clearSlot(draft, "a")); }} />
          <button
            type="button"
            className="icon-btn versus-bar__swap"
            aria-label="우리팀과 상대팀 바꾸기"
            disabled={!draft.a && !draft.b}
            onClick={() => { setNotice(""); setDraft(swapDraft(draft)); }}
          >
            ⇄
          </button>
          <SlotBox slot="b" draft={draft} region={regionOf.get(draft.b) ?? ""}
            onActivate={() => { setNotice(""); setDraft(activate(draft, "b")); }}
            onClear={() => { setNotice(""); setDraft(clearSlot(draft, "b")); }} />
        </div>
        <p className="caption versus-picker__target" aria-live="polite">
          선택 대상 <b>{L}학교</b>
          {draft[draft.active] ? " · 다른 학교를 누르면 바뀝니다" : ""}
        </p>
        {(notice || (draft.a && draft.b && missing)) && (
          <p className="caption versus-picker__notice" role="status">{notice || missing}</p>
        )}
      </div>

      <div className="filter-bar">
        <div className="filter-bar__row">
          <select className="m-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="지역 선택">
            <option value="">지역 전체</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="search-pill" style={{ flex: 1, minWidth: 140 }}>
            <SearchIcon />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="학교명 검색" aria-label="학교명 검색" />
          </div>
          {(region || query) && (
            <button type="button" className="chip" onClick={() => { setRegion(""); setQuery(""); }}>초기화</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="state">학교 목록을 불러오는 중…</div>
      ) : failed ? (
        <div className="state">학교 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
      ) : (
        <>
          <p className="caption-sm" style={{ margin: "0 0 10px" }}>{filtered.length}개 학교</p>
          {filtered.length > 0 ? (
            // 필터가 바뀌면 결과 개수가 같아도 첫 페이지부터 보이도록 key로 다시 만든다.
            <PagedCardGrid key={`${region}|${query}`} perPage={10} compact>
              {filtered.map((t) => {
                const tag: Slot | null = t.name === draft.a ? "a" : t.name === draft.b ? "b" : null;
                const games = t.rec.w + t.rec.l + t.rec.d;
                return (
                  <button
                    key={t.name}
                    type="button"
                    className={`sch-team-card team-summary-card versus-pick-card${tag ? ` is-picked is-picked-${tag}` : ""}`}
                    aria-pressed={!!tag}
                    aria-label={`${t.name}${t.region ? ` ${t.region}` : ""}${tag ? `, ${SLOT_LABEL[tag]}학교로 선택됨` : `, ${L}학교로 선택`}`}
                    onClick={() => pick(t.name)}
                  >
                    <div className="sch-team-card__head">
                      <h3 title={t.name}>{t.name}</h3>
                      {t.region && <span className="sch-team-card__reg">{t.region}</span>}
                    </div>
                    <div className="team-summary-card__record">
                      {games > 0 ? (
                        <>
                          <span className="team-summary-card__wins">{t.rec.w}승</span>
                          <span className="team-summary-card__losses">{t.rec.l}패</span>
                          {t.rec.d > 0 && <span className="team-summary-card__draws">{t.rec.d}무</span>}
                        </>
                      ) : (
                        <span className="team-summary-card__draws">{year} 경기 기록 없음</span>
                      )}
                      {tag && <span className="versus-pick-card__tag">{SLOT_LABEL[tag]} 선택됨</span>}
                    </div>
                  </button>
                );
              })}
            </PagedCardGrid>
          ) : (
            <div className="state">검색 결과가 없습니다. 학교명이나 지역을 바꿔 보세요.</div>
          )}
        </>
      )}

      <div className="versus-picker__footer">
        {editing && (
          <button type="button" className="btn btn--secondary versus-picker__cancel" onClick={cancel}>취소</button>
        )}
        <button
          type="button"
          className="btn btn--primary versus-picker__go"
          disabled={!canConfirm(draft)}
          aria-describedby="versus-picker-hint"
          onClick={confirm}
        >
          매치업 보기
        </button>
        <p id="versus-picker-hint" className="caption-sm versus-picker__hint">
          {missing || `${draft.a} vs ${draft.b}`}
        </p>
      </div>
    </div>
  );
}
