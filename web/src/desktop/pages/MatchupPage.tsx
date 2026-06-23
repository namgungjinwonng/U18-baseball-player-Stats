import { useState } from "react";
import { usePlayerIndex, useMatchups } from "../../shared/data";
import { rate } from "../../shared/format";
import type { PlayerIndexEntry } from "../../shared/types";

function PickList({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: PlayerIndexEntry[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="heading-md">{title}</h3>
      <div className="pick-list">
        {items.map((p) => (
          <button
            key={p.id}
            className={selected === p.id ? "sel" : ""}
            onClick={() => onSelect(p.id)}
          >
            {p.name} <span className="muted">· {p.team}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MatchupPage() {
  const { data: index } = usePlayerIndex();
  const { data: matchups } = useMatchups();
  const [batter, setBatter] = useState<string>();
  const [pitcher, setPitcher] = useState<string>();

  const batters = (index ?? []).filter((p) => p.position !== "투수");
  const pitchers = (index ?? []).filter((p) => p.position === "투수");

  const found =
    batter && pitcher
      ? (matchups ?? []).find(
          (m) => m.batterId === batter && m.pitcherId === pitcher
        )
      : undefined;

  return (
    <div className="container page">
      <div className="section-head">
        <h2 className="heading-xl">상대전적 · 타자 vs 투수</h2>
      </div>

      <div className="matchup-pick">
        <PickList
          title="타자 선택"
          items={batters}
          selected={batter}
          onSelect={setBatter}
        />
        <span className="vs">VS</span>
        <PickList
          title="투수 선택"
          items={pitchers}
          selected={pitcher}
          onSelect={setPitcher}
        />
      </div>

      {batter && pitcher ? (
        found ? (
          <div className="stat-strip">
            <div className="stat">
              <div className="k">타율</div>
              <div className="v">{rate(found.avg)}</div>
            </div>
            <div className="stat">
              <div className="k">타석</div>
              <div className="v">{found.pa}</div>
            </div>
            <div className="stat">
              <div className="k">타수-안타</div>
              <div className="v">
                {found.ab}-{found.h}
              </div>
            </div>
            <div className="stat">
              <div className="k">홈런</div>
              <div className="v">{found.hr}</div>
            </div>
            <div className="stat">
              <div className="k">볼넷</div>
              <div className="v">{found.bb}</div>
            </div>
            <div className="stat">
              <div className="k">삼진</div>
              <div className="v">{found.so}</div>
            </div>
          </div>
        ) : (
          <div className="state muted">
            아직 두 선수 간 맞대결 기록이 없습니다. (2026 시즌부터 누적)
          </div>
        )
      ) : (
        <div className="state muted">타자와 투수를 각각 선택하세요.</div>
      )}
    </div>
  );
}
