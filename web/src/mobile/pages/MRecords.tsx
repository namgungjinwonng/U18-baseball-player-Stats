import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLeagueAverages, useTournamentRecords } from "../../shared/data";
import { recordTabs, filterByKind } from "../../shared/columns";
import { StatTable } from "../../shared/StatTable";
import { Chip } from "../../design/ui";
import { FilterBar, applyFilter, filterFromQuery, filterToQuery, useQualifyContext, type RecordFilter } from "../../shared/filters";
import { describeQualify, isQualifiedBat, isQualifiedPit } from "../../shared/leaders";
import { Ico } from "../../shared/navIcons";
import type { Player } from "../../shared/types";

export function MRecords() {
  const location = useLocation();
  const nav = useNavigate();
  const [tabId, setTabId] = useState("hit-basic");
  const [filter, setFilter] = useState<RecordFilter>(() => filterFromQuery(location.search));
  const [includeUnqualified, setIncludeUnqualified] = useState(false);
  const { data: players, loading } = useTournamentRecords(filter.tournament);
  const { data: averages } = useLeagueAverages();
  const ctx = useQualifyContext(filter);
  const changeFilter = (next: RecordFilter) => {
    setFilter(next);
    nav({ pathname: location.pathname, search: filterToQuery(next) }, { replace: true });
  };
  // 세부 탭 wRC+/WAR 기준 리그평균: 시합 필터 시 그 시합, 아니면 시즌 전체.
  const lg = useMemo(() => {
    if (!averages) return null;
    if (filter.tournament) return averages.tournaments[filter.tournament]?.rates ?? null;
    return averages.overall;
  }, [averages, filter.tournament]);
  const tabs = useMemo(() => recordTabs(lg), [lg]);
  const tab = tabs.find((t) => t.id === tabId)!;
  // 랭킹 페이지와 동일하게 규정 미달 선수는 기본 제외 (토글로 포함 가능).
  const rows = useMemo(() => {
    if (!players) return [];
    const filtered = applyFilter(filterByKind(players, tab.kind), filter);
    if (includeUnqualified) return filtered;
    return filtered.filter((p) =>
      tab.kind === "batting" ? isQualifiedBat(p, ctx) : isQualifiedPit(p, ctx)
    );
  }, [players, tab.kind, filter, includeUnqualified, ctx]);

  return (
    <div className="m-page m-records-page">
      <h2 className="heading-xl"><Ico name="records" variant="title" />선수 기록</h2>
      <div className="m-tabs m-records-head">
        {tabs.map((t) => (
          <Chip key={t.id} active={t.id === tabId} onClick={() => setTabId(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      <FilterBar rows={players ?? []} value={filter} onChange={changeFilter} />
      <label className="qual-toggle">
        <input
          type="checkbox"
          checked={includeUnqualified}
          onChange={(e) => setIncludeUnqualified(e.target.checked)}
        />
        규정 미달 포함 — {describeQualify(ctx, tab.kind)}
      </label>
      {loading && <div className="state">불러오는 중…</div>}
      {players && (
        <StatTable<Player>
          key={tab.id}
          columns={tab.columns}
          rows={rows}
          initialSort={tab.initialSort}
          rowKey={(p) => p.id}
          onRowClick={(p) => nav(`/player/${p.id}${filterToQuery(filter)}`)}
        />
      )}
    </div>
  );
}
