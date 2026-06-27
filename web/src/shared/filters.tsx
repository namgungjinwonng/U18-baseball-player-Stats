// 지역/학교 필터 — 선수 기록·시즌 리더 공용 (데스크탑·모바일).
import { useMemo } from "react";

export interface RecordFilter {
  region: string;
  team: string;
}
export const emptyFilter: RecordFilter = { region: "", team: "" };

interface HasTeam {
  team: string;
  region?: string;
}

export function applyFilter<T extends HasTeam>(rows: T[], f: RecordFilter): T[] {
  return rows.filter(
    (p) => (!f.region || p.region === f.region) && (!f.team || p.team === f.team)
  );
}

export function FilterBar({
  rows,
  value,
  onChange,
}: {
  rows: HasTeam[];
  value: RecordFilter;
  onChange: (f: RecordFilter) => void;
}) {
  const regions = useMemo(
    () => [...new Set(rows.map((r) => r.region).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ko")),
    [rows]
  );
  // 학교는 선택된 지역으로 한정(캐스케이드)
  const teams = useMemo(
    () =>
      [...new Set(rows.filter((r) => !value.region || r.region === value.region).map((r) => r.team))].sort(
        (a, b) => a.localeCompare(b, "ko")
      ),
    [rows, value.region]
  );

  return (
    <div className="filter-bar">
      <select
        className="m-select"
        value={value.region}
        onChange={(e) => onChange({ region: e.target.value, team: "" })}
        aria-label="지역 선택"
      >
        <option value="">지역 선택</option>
        {regions.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <select
        className="m-select"
        value={value.team}
        onChange={(e) => onChange({ ...value, team: e.target.value })}
        aria-label="학교 선택"
      >
        <option value="">학교 선택</option>
        {teams.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}
