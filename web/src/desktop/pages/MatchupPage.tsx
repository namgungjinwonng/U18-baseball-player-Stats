import { useMemo, useState } from "react";
import { usePlayerIndex, useMatchups } from "../../shared/data";
import { rate } from "../../shared/format";
import { Chip } from "../../design/ui";
import {
  facedOpponents, indexById, opposite, playerLabel, searchByRole, type Role,
} from "../../shared/matchup";
import type { PlayerIndexEntry } from "../../shared/types";

export function MatchupPage() {
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

  function reset(role: Role) {
    setARole(role);
    setA(null);
    setQuery("");
    setBId("");
  }

  const bRoleLabel = opposite(aRole) === "pitcher" ? "투수" : "타자";

  return (
    <div className="container page">
      <div className="section-head">
        <h2 className="heading-xl">상대전적 · 타자 vs 투수</h2>
      </div>

      {/* 1) A 역할 선택 */}
      <p className="caption" style={{ marginBottom: 8 }}>① 기준 선수 유형</p>
      <div className="tabs">
        <Chip active={aRole === "batter"} onClick={() => reset("batter")}>타자</Chip>
        <Chip active={aRole === "pitcher"} onClick={() => reset("pitcher")}>투수</Chip>
      </div>

      {/* 2) A 선수 검색/선택 */}
      <p className="caption" style={{ margin: "16px 0 8px" }}>
        ② {aRole === "batter" ? "타자" : "투수"} 이름 검색
      </p>
      {a ? (
        <div className="picked">
          <span><b>{a.name}</b> <span className="muted">{playerLabel(a).replace(`${a.name} `, "")}</span></span>
          <button className="btn btn--secondary btn--sm" onClick={() => reset(aRole)}>변경</button>
        </div>
      ) : (
        <div className="ac" style={{ maxWidth: 480 }}>
          <div className="search-pill">
            <span aria-hidden>⌕</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${aRole === "batter" ? "타자" : "투수"} 이름 입력`}
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
        </div>
      )}

      {/* 3) B = 상대한 선수 드롭다운(자동) */}
      {a && (
        <>
          <p className="caption" style={{ margin: "20px 0 8px" }}>
            ③ 상대한 {bRoleLabel} 선택 ({faced.length}명)
          </p>
          {faced.length === 0 ? (
            <div className="state muted">맞대결 기록이 있는 {bRoleLabel}가 없습니다.</div>
          ) : (
            <select className="m-select" style={{ maxWidth: 480 }} value={bId} onChange={(e) => setBId(e.target.value)}>
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

      {/* 4) 결과 */}
      {selected && (
        <div className="stat-strip" style={{ marginTop: 24 }}>
          <Stat k="타율" v={rate(selected.avg)} />
          <Stat k="타석" v={String(selected.pa)} />
          <Stat k="타수-안타" v={`${selected.ab}-${selected.h}`} />
          <Stat k="홈런" v={String(selected.hr)} />
          <Stat k="볼넷" v={String(selected.bb)} />
          <Stat k="삼진" v={String(selected.so)} />
        </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
