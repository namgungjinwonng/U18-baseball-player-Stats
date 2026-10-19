// 선수 기록 표 상단 컨트롤 — 타자/투수 × 기본/세부/세이버 칩, 리그 대비 색 범례, 비교 선택 바 (데스크탑·모바일 공용).
import { Chip } from "../design/ui";
import { RECORD_KINDS, RECORD_PRESETS, type RecordKind, type RecordPreset } from "./columns";

export const MAX_COMPARE = 3;

export function RecordTabChips({
  kind, preset, onKind, onPreset, compareMode, onCompareMode,
}: {
  kind: RecordKind;
  preset: RecordPreset;
  onKind: (kind: RecordKind) => void;
  onPreset: (preset: RecordPreset) => void;
  compareMode: boolean;
  onCompareMode: (on: boolean) => void;
}) {
  return (
    <div className="record-chips">
      <div className="record-chips__row">
        {RECORD_KINDS.map((k) => (
          <Chip key={k.id} active={kind === k.id} onClick={() => onKind(k.id)}>{k.label}</Chip>
        ))}
        <span className="record-chips__sep" aria-hidden />
        {RECORD_PRESETS.map((p) => (
          <Chip key={p.id} active={preset === p.id} onClick={() => onPreset(p.id)}>{p.label}</Chip>
        ))}
        <button
          type="button"
          className={`record-chips__compare ${compareMode ? "active" : ""}`}
          aria-pressed={compareMode}
          onClick={() => onCompareMode(!compareMode)}
        >
          {compareMode ? "비교 끄기" : "비교"}
        </button>
      </div>
    </div>
  );
}

// 세부·세이버 표의 셀 색 의미 — 빨강 = 리그 평균보다 좋음, 파랑 = 나쁨.
export function HeatLegend() {
  return (
    <p className="heat-legend">
      <span className="heat-legend__sw heat-legend__sw--good" aria-hidden />리그 평균보다 좋음
      <span className="heat-legend__sw heat-legend__sw--bad" aria-hidden />나쁨
    </p>
  );
}

export function CompareBar({
  picked, names, onClear, onGo,
}: {
  picked: string[];
  names: Map<string, string>;
  onClear: () => void;
  onGo: () => void;
}) {
  return (
    <div className="compare-bar" role="status">
      <span className="compare-bar__text">
        {picked.length === 0
          ? `행을 눌러 ${MAX_COMPARE}명까지 고르세요`
          : picked.map((id) => names.get(id) ?? id).join(" · ")}
      </span>
      {picked.length > 0 && (
        <button type="button" className="link-btn" onClick={onClear}>해제</button>
      )}
      <button type="button" className="btn btn--primary btn--sm" disabled={picked.length < 2} onClick={onGo}>
        비교 {picked.length}/{MAX_COMPARE}
      </button>
    </div>
  );
}

// 선택 토글 — 이미 있으면 빼고, 꽉 찼으면 가장 먼저 고른 선수를 밀어낸다.
export function togglePick(picked: string[], id: string): string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  return [...picked, id].slice(-MAX_COMPARE);
}
