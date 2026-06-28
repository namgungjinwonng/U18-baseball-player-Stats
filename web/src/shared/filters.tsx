// 지역/학교/시합 필터 — 선수 기록·시즌 리더 공용 (데스크탑·모바일).
import { useMemo, useState } from "react";
import { useTournaments } from "./data";
import { buildTree, type Kind, type Phase } from "./tournamentTree";

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

// 시합구분 셀렉터: 시합구분(주말리그/전국대회) → (주말리그면) 상·하반기 → 리그(권역).
// 전체 시즌 = 모든 셀렉터 "전체". 최종 leaf 선택 시에만 onChange 로 slug 전달.
// availableSlugs 지정 시 해당 슬러그만 노출(예: 선수 상세 → 출전 시합만).
export function TournamentPicker({
  value,
  onChange,
  availableSlugs,
}: {
  value: string;
  onChange: (slug: string) => void;
  availableSlugs?: ReadonlySet<string>;
}) {
  const { data: rawTournaments } = useTournaments();
  const tournaments = useMemo(
    () =>
      rawTournaments && availableSlugs
        ? rawTournaments.filter((t) => availableSlugs.has(t.slug))
        : rawTournaments,
    [rawTournaments, availableSlugs]
  );
  const tree = useMemo(() => (tournaments ? buildTree(tournaments) : null), [tournaments]);
  const [kind, setKind] = useState<"" | Kind>("");
  const [phase, setPhase] = useState<"" | Phase>("");

  // ⚠ value 가 빈 문자열이 되면 내부 cascade 도 자동 초기화하는 useEffect 는 두지 말 것.
  // 사용자가 시합구분=주말리그 만 고르고 아직 leaf(리그) 미선택 시 onChange("") 가 호출되며,
  // 그 useEffect 가 setKind("") 로 cascade 를 즉시 풀어버려 시합구분 자체가 초기화되는 버그.

  if (!tree || (tree.주말리그.전반기.length + tree.주말리그.후반기.length + tree.전국대회.length === 0)) {
    return null;
  }

  const leagueList = kind === "주말리그" && phase ? tree.주말리그[phase] : [];

  return (
    <>
      <select
        className="m-select"
        value={kind}
        onChange={(e) => {
          const k = e.target.value as "" | Kind;
          setKind(k);
          setPhase("");
          onChange(""); // 구분 바꾸면 leaf 해제 = 시즌 전체
        }}
        aria-label="시합구분"
      >
        <option value="">전체 시즌</option>
        <option value="주말리그">주말리그</option>
        <option value="전국대회">전국대회</option>
      </select>

      {kind === "주말리그" && (
        <select
          className="m-select"
          value={phase}
          onChange={(e) => {
            const p = e.target.value as "" | Phase;
            setPhase(p);
            onChange("");
          }}
          aria-label="상·하반기"
        >
          <option value="">상·하반기 선택</option>
          <option value="전반기">전반기</option>
          <option value="후반기">후반기</option>
        </select>
      )}

      {kind === "주말리그" && phase && (
        <select
          className="m-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="리그 선택"
        >
          <option value="">리그 선택 ({leagueList.length}개)</option>
          {leagueList.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.region ?? t.title} ({t.gameCount}경기)
            </option>
          ))}
        </select>
      )}

      {kind === "전국대회" && (
        <select
          className="m-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="전국대회 선택"
        >
          <option value="">전국대회 선택 ({tree.전국대회.length}개)</option>
          {tree.전국대회.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title} ({t.gameCount}경기)
            </option>
          ))}
        </select>
      )}
    </>
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
      {showTournament && (
        <div className="filter-bar__row filter-bar__row--tournament">
          <TournamentPicker
            value={value.tournament}
            onChange={(slug) => onChange({ ...value, tournament: slug })}
          />
        </div>
      )}
      <div className="filter-bar__row filter-bar__row--2col">
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
    </div>
  );
}
