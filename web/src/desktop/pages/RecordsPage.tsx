import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournamentRecords } from "../../shared/data";
import { recordTabs, filterByKind } from "../../shared/columns";
import { StatTable } from "../../shared/StatTable";
import { Chip } from "../../design/ui";
import { FilterBar, applyFilter, emptyFilter, type RecordFilter } from "../../shared/filters";
import type { Player } from "../../shared/types";

export function RecordsPage() {
  const [tabId, setTabId] = useState(recordTabs[0].id);
  const [filter, setFilter] = useState<RecordFilter>(emptyFilter);
  const { data: players, loading, error } = useTournamentRecords(filter.tournament);
  const nav = useNavigate();
  const tab = recordTabs.find((t) => t.id === tabId)!;
  const rows = useMemo(
    () => (players ? applyFilter(filterByKind(players, tab.kind), filter) : []),
    [players, tab.kind, filter]
  );

  return (
    <div className="container page">
      <div className="section-head">
        <h2 className="heading-xl">선수 기록</h2>
      </div>
      <div className="tabs">
        {recordTabs.map((t) => (
          <Chip key={t.id} active={t.id === tabId} onClick={() => setTabId(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      {players && <FilterBar rows={players} value={filter} onChange={setFilter} />}

      {loading && <div className="state">불러오는 중…</div>}
      {error && <div className="state">데이터를 불러오지 못했습니다.</div>}
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
