import { useMemo, useState } from "react";
import { usePlayerIndex, useMatchups } from "../../shared/data";
import { rate } from "../../shared/format";
import { Chip } from "../../design/ui";
import {
  facedOpponents, indexById, opposite, playerLabel, searchByRole, type Role,
} from "../../shared/matchup";
import type { PlayerIndexEntry } from "../../shared/types";

export function MMatchup() {
  const { data: index } = usePlayerIndex();
  const { data: matchups } = useMatchups();
  const [aRole, setARole] = useState<Role>("batter");
  const [query, setQuery] = useState("");
  const [a, setA] = useState<PlayerIndexEntry | null>(null);
  const [bId, setBId] = useState("");

  const byId = useMemo(() => indexById(index ?? []), [index]);
  const candidates = useMemo(
    () => (index ? searchByRole(index, aRole, query) : []),
    [index, aRole, query]
  );
  const faced = useMemo(
    () => (a && matchups ? facedOpponents(matchups, byId, aRole, a.id) : []),
    [a, matchups, byId, aRole]
  );
  const selected = faced.find((f) => f.opponent.id === bId)?.matchup;
  const bRoleLabel = opposite(aRole) === "pitcher" ? "투수" : "타자";

  function reset(role: Role) {
    setARole(role);
    setA(null);
    setQuery("");
    setBId("");
  }

  return (
    <div className="m-page">
      <h2 className="heading-xl">상대전적</h2>
      <p className="caption" style={{ marginTop: -8, marginBottom: 16 }}>타자 vs 투수</p>

      <label className="caption">① 기준 선수 유형</label>
      <div className="m-tabs" style={{ marginTop: 8 }}>
        <Chip active={aRole === "batter"} onClick={() => reset("batter")}>타자</Chip>
        <Chip active={aRole === "pitcher"} onClick={() => reset("pitcher")}>투수</Chip>
      </div>

      <label className="caption">② {aRole === "batter" ? "타자" : "투수"} 이름 검색</label>
      {a ? (
        <div className="picked" style={{ maxWidth: "none", marginTop: 8 }}>
          <span><b>{a.name}</b> <span className="muted">{playerLabel(a).replace(`${a.name} `, "")}</span></span>
          <button className="btn btn--secondary btn--sm" onClick={() => reset(aRole)}>변경</button>
        </div>
      ) : (
        <>
          <div className="search-pill" style={{ marginTop: 8 }}>
            <span aria-hidden>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${aRole === "batter" ? "타자" : "투수"} 이름`}
              aria-label="선수 이름 검색"
            />
          </div>
          {query && (
            <div className="ac-list">
              {candidates.length === 0 && <div className="ac-empty muted">결과 없음</div>}
              {candidates.map((p) => (
                <button key={p.id} className="ac-item" onClick={() => { setA(p); setQuery(""); }}>
                  {playerLabel(p)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {a && (
        <>
          <label className="caption" style={{ display: "block", marginTop: 16 }}>
            ③ 상대한 {bRoleLabel} ({faced.length}명)
          </label>
          {faced.length === 0 ? (
            <div className="state muted">맞대결 기록이 있는 {bRoleLabel}가 없습니다.</div>
          ) : (
            <select className="m-select" value={bId} onChange={(e) => setBId(e.target.value)}>
              <option value="">{bRoleLabel} 선택</option>
              {faced.map(({ opponent, matchup }) => (
                <option key={opponent.id} value={opponent.id}>
                  {playerLabel(opponent)} — {matchup.ab}타수 {matchup.h}안타
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {selected && (
        <div className="m-strip" style={{ marginTop: 16 }}>
          <div className="cell"><div className="k">타율</div><div className="v">{rate(selected.avg)}</div></div>
          <div className="cell"><div className="k">타수-안타</div><div className="v">{selected.ab}-{selected.h}</div></div>
          <div className="cell"><div className="k">타석</div><div className="v">{selected.pa}</div></div>
          <div className="cell"><div className="k">2루타</div><div className="v">{selected.b2}</div></div>
          <div className="cell"><div className="k">3루타</div><div className="v">{selected.b3}</div></div>
          <div className="cell"><div className="k">홈런</div><div className="v">{selected.hr}</div></div>
          <div className="cell"><div className="k">볼넷</div><div className="v">{selected.bb}</div></div>
          <div className="cell"><div className="k">사구</div><div className="v">{selected.hbp}</div></div>
          <div className="cell"><div className="k">삼진</div><div className="v">{selected.so}</div></div>
        </div>
      )}
    </div>
  );
}
