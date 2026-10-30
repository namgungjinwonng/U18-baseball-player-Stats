// 경기분석 「분석 항목」 이전·현재·다음 선택기(랭킹 항목 선택기와 같은 모양)와 「분석 기준」 3칸 선택
import { useState } from "react";

export interface PickItem<T extends string> { id: T; label: string; note?: string; disabled?: boolean }

interface Props<T extends string> {
  label: string;
  items: PickItem<T>[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
}

// ‹ 이전 | 현재 | 다음 › + 「전체 항목에서 바로 선택」 — 끝에서 처음으로 돌아간다.
export function StepPicker<T extends string>({ label, items, value, onChange, disabled }: Props<T>) {
  const [open, setOpen] = useState(false);
  const n = items.length;
  const i = Math.max(0, items.findIndex((x) => x.id === value));
  const prev = items[(i - 1 + n) % n], cur = items[i], next = items[(i + 1) % n];
  const choose = (id: T) => {
    onChange(id);
    setOpen(false);
  };
  return (
    <div className="ai-pick">
      <span className="ai-pick__label">{label}</span>
      <div className="leader-cat-stepper ai-stepper" role="group" aria-label={label}>
        <button type="button" className="leader-cat-step" disabled={disabled} aria-label={`이전 항목 ${prev.label}`} onClick={() => choose(prev.id)}>
          <span className="leader-cat-arrow" aria-hidden="true">‹</span>
          <span>{prev.label}</span>
        </button>
        <div className="leader-cat-current" aria-live="polite">
          <strong>{cur.label}</strong>
          {cur.note && <small>{cur.note}</small>}
        </div>
        <button type="button" className="leader-cat-step" disabled={disabled} aria-label={`다음 항목 ${next.label}`} onClick={() => choose(next.id)}>
          <span>{next.label}</span>
          <span className="leader-cat-arrow" aria-hidden="true">›</span>
        </button>
      </div>
      <button type="button" className="btn btn--secondary leader-cat-toggle" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        {open ? "전체 항목 닫기" : "전체 항목에서 바로 선택"}
      </button>
      {open && (
        <div className="leader-cat-panel ai-pick__panel" role="radiogroup" aria-label={`${label} 전체`}>
          {items.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={x.id === value} disabled={disabled || x.disabled}
              className={`chip ${x.id === value ? "chip--active" : ""}`} onClick={() => choose(x.id)}>
              {x.label}
              {x.note && <small>{x.note}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 항목이 적을 때(분석 기준 3개) — 한 줄 3칸, 고른 칸을 진하게
export function SegmentPicker<T extends string>({ label, items, value, onChange, disabled }: Props<T>) {
  return (
    <div className="ai-pick">
      <span className="ai-pick__label">{label}</span>
      <div className="ai-seg" role="radiogroup" aria-label={label}>
        {items.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={x.id === value} disabled={disabled || x.disabled}
            className={x.id === value ? "is-on" : undefined} onClick={() => onChange(x.id)}>
            <b>{x.label}</b>
            {x.note && <small>{x.note}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}
