// 경기분석 연습경기 구장 선택 — 야구장 현황과 같은 시·도 → 시·군·구 → 이름 검색으로 좁혀 고른다(값은 야구장 현황 ID)
import { useMemo, useState } from "react";
import { useFields } from "../data";
import { FIELD_GROUPS, filterFields, sidoCounts, sidoOptions, sigunguCounts } from "../fieldFilter";

export function VenuePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useFields();
  const all = useMemo(() => data?.fields ?? [], [data]);
  const picked = all.find((f) => f.id === value);
  // 고른 구장이 있으면 그 지역에서 시작한다.
  const [sido, setSido] = useState(picked?.sido ?? "");
  const [sgg, setSgg] = useState(picked?.sigungu ?? "");
  const [q, setQ] = useState("");
  const counts = useMemo(() => sidoCounts(all), [all]);
  const sggs = useMemo(() => sigunguCounts(all, sido), [all, sido]);
  const shown = useMemo(() => filterFields(all, sido, sgg, q), [all, sido, sgg, q]);
  const groups = FIELD_GROUPS.map((g) => ({ ...g, items: shown.filter((f) => f.kind === g.kind) })).filter((g) => g.items.length);
  const pickedHidden = picked && !shown.includes(picked);

  return (
    <div className="ai-venue">
      <div className="ai-venue__filters">
        <select aria-label="구장 시·도" value={sido} onChange={(e) => { setSido(e.target.value); setSgg(""); }}>
          <option value="">시·도 선택</option>
          {sidoOptions(counts).map((s) => <option key={s} value={s}>{s} ({counts.get(s)})</option>)}
        </select>
        <select aria-label="구장 시·군·구" value={sgg} disabled={!sido} onChange={(e) => setSgg(e.target.value)}>
          <option value="">{sido ? "시·군·구 전체" : "시·군·구"}</option>
          {sggs.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
        </select>
      </div>
      <input type="search" aria-label="구장 이름 검색" placeholder="학교·구장 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      <select aria-label="구장" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{shown.length ? `모름 · 날씨 제외 (${shown.length}곳 중 선택)` : "모름 · 날씨 제외 — 시·도나 이름으로 찾기"}</option>
        {pickedHidden && <option value={picked.id}>{picked.name} · {picked.sido} {picked.sigungu}</option>}
        {groups.map((g) => (
          <optgroup key={g.kind} label={g.label}>
            {g.items.map((f) => <option key={f.id} value={f.id}>{f.name}{sgg ? "" : ` · ${f.sigungu}`}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
