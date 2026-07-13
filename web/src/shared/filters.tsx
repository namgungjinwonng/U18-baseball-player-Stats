// 지역/학교/학년/시합 필터 — 선수 기록·시즌 리더 공용 (데스크탑·모바일).
import { useEffect, useMemo, useState } from "react";
import { useMeta, useTournamentMeta, useTournaments } from "./data";
import { useYear } from "./year";
import { seasonConfig, type QualifyContext, type ScopeKind } from "./leaders";
import { buildTree, categorize, type Kind, type Phase } from "./tournamentTree";

export interface RecordFilter {
  region: string;
  team: string;
  grade: string; // "1"/"2"/"3" ("" = 전체 학년)
  tournament: string; // tournament slug ("" = 시즌 전체)
}
export const emptyFilter: RecordFilter = { region: "", team: "", grade: "", tournament: "" };

// URL ↔ RecordFilter 직렬화 (홈/랭킹 페이지 사이 필터 전파에 사용).
export function filterToQuery(f: RecordFilter): string {
  const p = new URLSearchParams();
  if (f.tournament) p.set("t", f.tournament);
  if (f.region) p.set("r", f.region);
  if (f.team) p.set("s", f.team);
  if (f.grade) p.set("g", f.grade);
  const s = p.toString();
  return s ? `?${s}` : "";
}
export function filterFromQuery(search: string): RecordFilter {
  const p = new URLSearchParams(search);
  return {
    tournament: p.get("t") ?? "",
    region: p.get("r") ?? "",
    team: p.get("s") ?? "",
    grade: p.get("g") ?? "",
  };
}

// 현재 필터(전체 시즌 / 주말리그 / 전국대회)에 맞는 규정 스코프 + 팀별 경기수 컨텍스트.
// 시합 필터 시 해당 시합 meta 의 teamGames 를, 아니면 시즌 meta 의 teamGames 를 쓴다.
export function useQualifyContext(filter: RecordFilter): QualifyContext {
  const { year } = useYear();
  const { data: seasonMeta } = useMeta();
  const { data: tournaments } = useTournaments();
  const { data: tMeta } = useTournamentMeta(filter.tournament);
  return useMemo(() => {
    const config = seasonConfig(year);
    let scope: ScopeKind = "season";
    if (filter.tournament) {
      const t = tournaments?.find((x) => x.slug === filter.tournament);
      scope = t && categorize(t).kind === "주말리그" ? "weekend" : "national";
    }
    const teamGames = (filter.tournament ? tMeta?.teamGames : seasonMeta?.teamGames) ?? {};
    return { scope, config, teamGames };
  }, [year, filter.tournament, tournaments, tMeta, seasonMeta]);
}

interface HasTeam {
  team: string;
  region?: string;
  grade?: string;
}

// 시합 필터는 상위(useTournamentRecords)에서 다른 records 파일을 로드해 적용하므로,
// 여기서는 지역/학교/학년 만 클라이언트 측에서 필터링.
export function applyFilter<T extends HasTeam>(rows: T[], f: RecordFilter): T[] {
  return rows.filter(
    (p) =>
      (!f.region || p.region === f.region) &&
      (!f.team || p.team === f.team) &&
      (!f.grade || p.grade === f.grade)
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

  // 외부에서 들어온 value(slug) 로부터 kind/phase 를 1회 추정해 표시 (URL query 전파 케이스).
  // ⚠ value="" 인 케이스에선 절대 cascade 를 초기화하지 말 것 — 사용자가 leaf 미선택 상태로
  // 자연히 비어있는 정상 상태이므로 useEffect 가 setKind("") 로 만들면 시합구분 자체가 풀려버림.
  useEffect(() => {
    if (kind || !value || !tournaments) return;
    const t = tournaments.find((x) => x.slug === value);
    if (!t) return;
    const c = categorize(t);
    setKind(c.kind);
    if (c.kind === "주말리그") setPhase(c.phase ?? "");
  }, [tournaments, value, kind]);

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
        aria-label="대회구분"
      >
        <option value="">대회 전체</option>
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
  // 학년은 선택된 지역/학교로 한정(캐스케이드)
  const grades = useMemo(
    () =>
      [...new Set(
        rows
          .filter((r) => (!value.region || r.region === value.region) && (!value.team || r.team === value.team))
          .map((r) => r.grade)
          .filter(Boolean) as string[]
      )].sort(),
    [rows, value.region, value.team]
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
      <div className="filter-bar__row filter-bar__row--3col">
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
        <select
          className="m-select"
          value={value.grade}
          onChange={(e) => onChange({ ...value, grade: e.target.value })}
          aria-label="학년 선택"
        >
          <option value="">학년 선택</option>
          {grades.map((g) => (
            <option key={g} value={g}>{g}학년</option>
          ))}
        </select>
      </div>
    </div>
  );
}
