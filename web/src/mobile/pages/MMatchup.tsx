import { useState } from "react";
import { usePlayerIndex, useMatchups } from "../../shared/data";
import { rate } from "../../shared/format";

export function MMatchup() {
  const { data: index } = usePlayerIndex();
  const { data: matchups } = useMatchups();
  const [batter, setBatter] = useState("");
  const [pitcher, setPitcher] = useState("");

  const batters = (index ?? []).filter((p) => p.position !== "투수");
  const pitchers = (index ?? []).filter((p) => p.position === "투수");

  const found =
    batter && pitcher
      ? (matchups ?? []).find(
          (m) => m.batterId === batter && m.pitcherId === pitcher
        )
      : undefined;

  return (
    <div className="m-page">
      <h2 className="heading-xl">상대전적</h2>
      <p className="caption" style={{ marginTop: -8, marginBottom: 16 }}>
        타자 vs 투수 · 2026 시즌부터 누적
      </p>

      <label className="caption">타자</label>
      <select
        className="m-select"
        value={batter}
        onChange={(e) => setBatter(e.target.value)}
      >
        <option value="">타자 선택</option>
        {batters.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.team}
          </option>
        ))}
      </select>

      <label className="caption">투수</label>
      <select
        className="m-select"
        value={pitcher}
        onChange={(e) => setPitcher(e.target.value)}
      >
        <option value="">투수 선택</option>
        {pitchers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.team}
          </option>
        ))}
      </select>

      {batter && pitcher ? (
        found ? (
          <div className="m-strip">
            <div className="cell">
              <div className="k">타율</div>
              <div className="v">{rate(found.avg)}</div>
            </div>
            <div className="cell">
              <div className="k">타수-안타</div>
              <div className="v">
                {found.ab}-{found.h}
              </div>
            </div>
            <div className="cell">
              <div className="k">타석</div>
              <div className="v">{found.pa}</div>
            </div>
            <div className="cell">
              <div className="k">홈런</div>
              <div className="v">{found.hr}</div>
            </div>
            <div className="cell">
              <div className="k">볼넷</div>
              <div className="v">{found.bb}</div>
            </div>
            <div className="cell">
              <div className="k">삼진</div>
              <div className="v">{found.so}</div>
            </div>
          </div>
        ) : (
          <div className="state muted">아직 맞대결 기록이 없습니다.</div>
        )
      ) : (
        <div className="state muted">타자와 투수를 선택하세요.</div>
      )}
    </div>
  );
}
