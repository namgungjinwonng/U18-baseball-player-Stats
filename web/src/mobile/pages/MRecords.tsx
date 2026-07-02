import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeagueAverages, useTournamentRecords } from "../../shared/data";
import { recordTabs, filterByKind } from "../../shared/columns";
import { StatTable } from "../../shared/StatTable";
import { Chip } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, type RecordFilter } from "../../shared/filters";
import type { Player } from "../../shared/types";

export function MRecords() {
  const [tabId, setTabId] = useState("hit-basic");
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const { data: players, loading } = useTournamentRecords(filter.tournament);
  const { data: averages } = useLeagueAverages();
  const nav = useNavigate();
  // 세부 탭 wRC+/WAR 기준 리그평균: 시합 필터 시 그 시합, 아니면 시즌 전체.
  const lg = useMemo(() => {
    if (!averages) return null;
    if (filter.tournament) return averages.tournaments[filter.tournament]?.rates ?? null;
    return averages.overall;
  }, [averages, filter.tournament]);
  const tabs = useMemo(() => recordTabs(lg), [lg]);
  const tab = tabs.find((t) => t.id === tabId)!;
  const rows = useMemo(
    () => (players ? applyFilter(filterByKind(players, tab.kind), filter) : []),
    [players, tab.kind, filter]
  );

  return (
    <div className="m-page">
      <h2 className="heading-xl">선수 기록</h2>
      <div className="m-tabs">
        {tabs.map((t) => (
          <Chip key={t.id} active={t.id === tabId} onClick={() => setTabId(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      <FilterBar rows={players ?? []} value={filter} onChange={setFilter} />
      {loading && <div className="state">불러오는 중…</div>}
      {players && (
        <StatTable<Player>
          columns={tab.columns}
          rows={rows}
          initialSort={tab.initialSort}
          rowKey={(p) => p.id}
          onRowClick={(p) => nav(`/player/${p.id}`)}
        />
      )}
    </div>
  );
}
