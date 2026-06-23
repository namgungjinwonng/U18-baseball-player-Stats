import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAllPlayers } from "../../shared/data";
import { recordTabs, filterByKind } from "../../shared/columns";
import { StatTable } from "../../shared/StatTable";
import { Chip } from "../../design/ui";
import type { Player } from "../../shared/types";

export function RecordsPage() {
  const { data: players, loading, error } = useAllPlayers();
  const [tabId, setTabId] = useState(recordTabs[0].id);
  const nav = useNavigate();
  const tab = recordTabs.find((t) => t.id === tabId)!;

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

      {loading && <div className="state">불러오는 중…</div>}
      {error && <div className="state">데이터를 불러오지 못했습니다.</div>}
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
