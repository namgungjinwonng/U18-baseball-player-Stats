// 경기분석 「분석 옵션」(B안) — 접힌 한 줄 요약, 펼치면 선수 범위(전학 간 선수·학년 제외)와 경기 조건(공식/연습경기·시작·구장, 선공은 AWAY)
import { useMemo, useState } from "react";
import { teamKey } from "../versus";
import type { AiOptionSupport } from "./AiAnalysisPanel";
import { ForecastNote } from "./ForecastNote";
import { GRADES, optionsSummary, scopeActive, type AiOptions, type Grade } from "./options";
import { VenuePicker } from "./VenuePicker";

const DAY = ["일", "월", "화", "수", "목", "금", "토"];
const shortDay = (date: string) => {
  const d = new Date(`${date}T00:00:00+09:00`);
  return `${d.getMonth() + 1}.${d.getDate()} (${DAY[d.getDay()]})`;
};

interface Props {
  opts: AiOptions;
  onChange: (o: AiOptions) => void;
  support: AiOptionSupport;
  aName: string;
  bName: string;
  disabled?: boolean;
}

export function AiOptionsBox({ opts, onChange, support, aName, bName, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<AiOptions>) => onChange({ ...opts, ...patch });
  const toggleGrade = (g: Grade) =>
    set({ excludeGrades: opts.excludeGrades.includes(g) ? opts.excludeGrades.filter((x) => x !== g) : [...opts.excludeGrades, g] });
  const sample = useMemo(() => support.sample(opts), [support, opts]);
  const on = scopeActive(opts) || opts.conditions;

  return (
    <div className="ai-options">
      <button type="button" className="ai-options__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <b>분석 옵션</b>
          <small className={on ? "is-on" : undefined}>{optionsSummary(opts)}</small>
        </span>
        <span aria-hidden className="ai-options__chev">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <fieldset className="ai-options__body" disabled={disabled}>
          <p className="ai-options__sec">선수 범위</p>
          <label className="ai-options__row">
            <input type="checkbox" checked={opts.excludeMovedOut} onChange={(e) => set({ excludeMovedOut: e.target.checked })} />
            다른 학교로 전학 간 선수 제외
          </label>
          <p className="ai-options__hint">전학 온 선수는 지금 학교 학년에 포함</p>
          {GRADES.map((g) => (
            <label key={g} className="ai-options__row">
              <input type="checkbox" checked={opts.excludeGrades.includes(g)} onChange={() => toggleGrade(g)} />
              {g}학년 제외
            </label>
          ))}
          {support.gradeNote && <p className="ai-options__hint">{support.gradeNote}</p>}

          <p className="ai-options__sec">경기 조건</p>
          <label className="ai-options__row">
            <input type="checkbox" checked={opts.conditions} onChange={(e) => set({ conditions: e.target.checked })} />
            시간·구장·날씨·선공/후공 반영
          </label>
          {opts.conditions && (
            <div className="ai-options__cond">
              <div className="ai-options__seg" role="radiogroup" aria-label="경기 종류">
                {(["official", "practice"] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={opts.gameKind === k}
                    className={opts.gameKind === k ? "is-on" : undefined} onClick={() => set({ gameKind: k })}>
                    {k === "official" ? "공식경기" : "연습경기"}
                  </button>
                ))}
              </div>
              {opts.gameKind === "official" ? (
                support.upcoming.length ? (
                  <label className="ai-options__field">
                    <span>대상 경기 · 일정의 원정 = AWAY·선공(초공), 홈 = HOME·후공(말공)</span>
                    <select value={opts.gameIdx} onChange={(e) => set({ gameIdx: e.target.value })}>
                      {support.upcoming.map((g) => (
                        <option key={g.game_idx} value={g.game_idx}>
                          {shortDay(g.date)} {g.time} {g.venue} · {teamKey(g.away.name)} 선공
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="ai-options__hint">두 학교의 남은 공식경기가 일정에 없습니다. 연습경기로 시작 시간을 넣어 주세요.</p>
                )
              ) : (
                <>
                  <p className="ai-options__hint">AWAY {aName} 선공(초공) · HOME {bName} 후공(말공) — 바꾸려면 위의 ⇄</p>
                  <label className="ai-options__field">
                    <span>경기 시작</span>
                    <input type="datetime-local" value={opts.start} onChange={(e) => set({ start: e.target.value })} />
                  </label>
                  <div className="ai-options__field">
                    <span>구장 · 선택 사항(모르면 날씨 제외)</span>
                    <VenuePicker value={opts.venue} onChange={(venue) => set({ venue })} />
                  </div>
                </>
              )}
              <ForecastNote opts={opts} upcoming={support.upcoming} />
            </div>
          )}
        </fieldset>
      )}
      {sample && (
        <p className="ai-options__warn" role="note">
          표본 줄어듦 — {sample.map((r) => `${r.team} ${r.text}`).join(", ")}.
          {support.gradeNote ? "" : " 팀 전적·맞대결은 전체 선수 기준."}
        </p>
      )}
    </div>
  );
}
