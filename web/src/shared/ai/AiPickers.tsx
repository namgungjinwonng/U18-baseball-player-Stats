// 경기분석 「분석 항목」 이전·현재·다음 선택기(랭킹 항목 선택기와 같은 모양, 좌우 스와이프)와 「분석 기준」 3칸 선택
import { useRef } from "react";

export interface PickItem<T extends string> { id: T; label: string; note?: string; disabled?: boolean }

interface Props<T extends string> {
  label: string;
  items: PickItem<T>[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
}

const SWIPE_PX = 40; // 이만큼 가로로 밀면 항목을 넘긴다

// ‹ 이전 | 현재 | 다음 › — 누르거나 좌우로 밀어 넘기고, 끝에서 처음으로 돌아간다.
export function StepPicker<T extends string>({ label, items, value, onChange, disabled }: Props<T>) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false); // 밀어서 넘겼으면 손을 뗄 때 따라오는 버튼 클릭은 무시한다
  const n = items.length;
  const i = Math.max(0, items.findIndex((x) => x.id === value));
  const prev = items[(i - 1 + n) % n], cur = items[i], next = items[(i + 1) % n];
  return (
    <div className="ai-pick">
      <span className="ai-pick__label">{label}</span>
      <div
        className="leader-cat-stepper ai-stepper"
        role="group"
        aria-label={label}
        onPointerDown={(e) => {
          swiped.current = false;
          start.current = disabled || e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          swiped.current = true;
          navigator.vibrate?.(10); // 안드로이드 크롬 등 지원 기기에서만 짧게 진동(iOS 사파리는 미지원)
          onChange(dx < 0 ? next.id : prev.id);
        }}
        onPointerCancel={() => { start.current = null; }}
        onClickCapture={(e) => {
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <button type="button" className="leader-cat-step" disabled={disabled} aria-label={`이전 항목 ${prev.label}`} onClick={() => onChange(prev.id)}>
          <span className="leader-cat-arrow" aria-hidden="true">‹</span>
          <span>{prev.label}</span>
        </button>
        <div className="leader-cat-current" aria-live="polite">
          <strong>{cur.label}</strong>
        </div>
        <button type="button" className="leader-cat-step" disabled={disabled} aria-label={`다음 항목 ${next.label}`} onClick={() => onChange(next.id)}>
          <span>{next.label}</span>
          <span className="leader-cat-arrow" aria-hidden="true">›</span>
        </button>
      </div>
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
