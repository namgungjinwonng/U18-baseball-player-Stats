import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAllPlayers } from "../../shared/data";
import { recordTabs, filterByKind } from "../../shared/columns";
import { StatTable } from "../../shared/StatTable";
import { Chip } from "../../design/ui";
import type { Player } from "../../shared/types";

export function MRecords() {
  const { data: players, loading } = useAllPlayers();
  const [tabId, setTabId] = useState(recordTabs[0].id);
  const nav = useNavigate();
  const tab = recordTabs.find((t) => t.id === tabId)!;

  return (
    <div className="m-page">
      <h2 className="heading-xl">선수 기록</h2>
      <div className="m-tabs">
        {recordTabs.map((t) => (
          <Chip key={t.id} active={t.id === tabId} onClick={() => setTabId(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      {loading && <div className="state">불러오는 중…</div>}
      {players && (
        <StatTable<Player>
          columns={tab.columns}
          rows={filterByKind(players, tab.kind)}
          initialSort={tab.initialSort}
          rowKey={(p) => p.id}
          onRowClick={(p) => nav(`/player/${p.id}`)}
        />
      )}
    </div>
  );
}
