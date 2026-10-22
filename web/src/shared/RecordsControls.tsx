// 선수 기록 표 상단 컨트롤 — 타자/투수 × 기본/세부/세이버 칩, 리그 대비 색 범례, 비교 선택 바 (데스크탑·모바일 공용).
import { useMemo, useState } from "react";
import { Chip } from "../design/ui";
import { resolvePicks, togglePickRef, type PickRef } from "./comparePicks";
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
  picked, names, onClear, onGo, max = MAX_COMPARE, unit = "명", goLabel = "비교",
}: {
  picked: string[];
  names: Map<string, string>;
  onClear: () => void;
  onGo: () => void;
  max?: number;
  unit?: string; // 안내 문구 단위 — 선수 "명", 학교 "곳"
  goLabel?: string;
}) {
  return (
    <div className="compare-bar" role="status">
      <span className="compare-bar__text">
        {picked.length === 0
          ? `행을 눌러 ${max}${unit}${max === 2 ? "을" : "까지"} 고르세요`
          : picked.map((id) => names.get(id) ?? id).join(" · ")}
      </span>
      {picked.length > 0 && (
        <button type="button" className="link-btn" onClick={onClear}>해제</button>
      )}
      <button type="button" className="btn btn--primary btn--sm" disabled={picked.length < 2} onClick={onGo}>
        {goLabel} {picked.length}/{max}
      </button>
    </div>
  );
}

// 선택 토글 — 이미 있으면 빼고, 꽉 찼으면 가장 먼저 고른 선수를 밀어낸다.
export function togglePick(picked: string[], id: string, max = MAX_COMPARE): string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  return [...picked, id].slice(-max);
}

// 선수 기록 표의 비교 선택. personNo로 기억해 두고 현재 시즌 목록에서 다시 찾으므로,
// 시즌을 바꾸면 선택 바·비교 버튼·이동 주소가 모두 현재 시즌 선수 기준이 된다(기록 없는 선수는 빠진다).
export function useComparePicks<T extends { id: string; personNo?: string; name: string }>(players: T[] | null) {
  const [refs, setRefs] = useState<PickRef[]>([]);
  const picked = useMemo(() => resolvePicks(refs, players), [refs, players]);
  return {
    picked,
    ids: picked.map((p) => p.id),
    names: new Map(picked.map((p) => [p.id, p.name])),
    // 토글 전에 현재 시즌에서 찾은 선수만 남겨, 사라진 선수가 최대 인원을 차지하지 않게 한다.
    toggle: (p: T) =>
      setRefs((prev) => togglePickRef(resolvePicks(prev, players).map((x) => ({ id: x.id, personNo: x.personNo })), p, MAX_COMPARE)),
    clear: () => setRefs([]),
  };
}
