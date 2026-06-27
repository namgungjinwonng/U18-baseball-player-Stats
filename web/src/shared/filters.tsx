// 지역/학교/시합 필터 — 선수 기록·시즌 리더 공용 (데스크탑·모바일).
import { useMemo } from "react";
import { useTournaments } from "./data";

export interface RecordFilter {
  region: string;
  team: string;
  tournament: string; // tournament slug ("" = 시즌 전체)
}
export const emptyFilter: RecordFilter = { region: "", team: "", tournament: "" };

interface HasTeam {
  team: string;
  region?: string;
}

// 시합 필터는 상위(useTournamentRecords)에서 다른 records 파일을 로드해 적용하므로,
// 여기서는 지역/학교 만 클라이언트 측에서 필터링.
export function applyFilter<T extends HasTeam>(rows: T[], f: RecordFilter): T[] {
  return rows.filter(
    (p) => (!f.region || p.region === f.region) && (!f.team || p.team === f.team)
  );
}

export function FilterBar({
  rows,
  value,
  onChange,
  showTournament = true,
}: {
  rows: HasTeam[];
  value: RecordFilter;
  onChange: (f: RecordFilter) => void;
  showTournament?: boolean;
}) {
  const { data: tournaments } = useTournaments();
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
      {showTournament && tournaments && tournaments.length > 0 && (
        <select
          className="m-select"
          value={value.tournament}
          onChange={(e) => onChange({ ...value, tournament: e.target.value })}
          aria-label="시합 선택"
        >
          <option value="">시즌 전체</option>
          {tournaments.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title} ({t.gameCount}경기)
            </option>
          ))}
        </select>
      )}
      <select
        className="m-select"
        value={value.region}
        onChange={(e) => onChange({ ...value, region: e.target.value, team: "" })}
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
