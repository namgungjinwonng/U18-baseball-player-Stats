// 세이버메트릭스 용어 라벨(클릭 시 설명 모달). 데스크탑/모바일 공용.
// 모달에는 정의·계산식과 함께 리그평균(전체/리그별/시합별 — 데이터 갱신 시점 재계산)을 표시.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TERM_MAP, type Term } from "./Glossary";
import { useLeagueAverages } from "./data";
import { categorize } from "./tournamentTree";
import { rate, dec2 } from "./format";
import { pct, dec1 } from "./sabermetrics";
import type { LeagueRates } from "./types";

export function SaberTerm({ abbr, children }: { abbr: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const term = TERM_MAP[abbr];
  if (!term) return <span>{children ?? abbr}</span>;
  return (
    <>
      <button
        type="button"
        className="saber-term"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${term.abbr} 설명 보기`}
      >
        {children ?? term.abbr}
      </button>
      {open && <TermModal term={term} onClose={() => setOpen(false)} />}
    </>
  );
}

function fmtStat(term: Term, v: number | undefined): string {
  if (v == null) return "-";
  switch (term.statFmt) {
    case "pct": return pct(v);
    case "dec1": return dec1(v);
    case "dec2": return dec2(v);
    default: return rate(v);
  }
}

// 리그평균 섹션: 전체 시즌 + 주말리그(리그별) + 전국대회(시합별).
function LeagueAvgSection({ term }: { term: Term }) {
  const { data: averages } = useLeagueAverages();
  const groups = useMemo(() => {
    if (!averages || !term.statKey) return null;
    const pick = (r: LeagueRates) => r[term.statKey as keyof LeagueRates] as number | undefined;
    const weekend: { label: string; value: string }[] = [];
    const national: { label: string; value: string }[] = [];
    for (const [slug, t] of Object.entries(averages.tournaments)) {
      const c = categorize({ slug, title: t.title, gameCount: 0 });
      const row = {
        label: c.kind === "주말리그" ? `${c.phase ?? ""} ${c.region ?? t.title}`.trim() : t.title,
        value: fmtStat(term, pick(t.rates)),
      };
      (c.kind === "주말리그" ? weekend : national).push(row);
    }
    weekend.sort((a, b) => a.label.localeCompare(b.label, "ko"));
    return {
      overall: fmtStat(term, pick(averages.overall)),
      weekend,
      national,
      updatedAt: averages.updatedAt,
    };
  }, [averages, term]);

  if (!term.statKey) return null;
  if (!groups) return null;

  const statLabel = term.avgNote ? undefined : term.abbr;
  return (
    <div className="modal-averages">
      <h4 className="modal-averages__title">
        리그 평균{statLabel ? ` (${statLabel})` : ""}
      </h4>
      {term.avgNote && <p className="caption" style={{ margin: "0 0 6px" }}>{term.avgNote}</p>}
      <div className="modal-averages__row modal-averages__row--overall">
        <span>전체 시즌</span>
        <b>{groups.overall}</b>
      </div>
      {groups.weekend.length > 0 && (
        <details className="modal-averages__group">
          <summary>리그별 (주말리그 {groups.weekend.length}개)</summary>
          {groups.weekend.map((g) => (
            <div className="modal-averages__row" key={g.label}>
              <span>{g.label}</span>
              <b>{g.value}</b>
            </div>
          ))}
        </details>
      )}
      {groups.national.length > 0 && (
        <details className="modal-averages__group">
          <summary>시합별 (전국대회 {groups.national.length}개)</summary>
          {groups.national.map((g) => (
            <div className="modal-averages__row" key={g.label}>
              <span>{g.label}</span>
              <b>{g.value}</b>
            </div>
          ))}
        </details>
      )}
      <p className="caption" style={{ marginTop: 6 }}>
        데이터 갱신 시점({new Date(groups.updatedAt).toLocaleDateString("ko-KR")}) 기준 재계산 값
      </p>
    </div>
  );
}

function TermModal({ term, onClose }: { term: Term; onClose: () => void }) {
  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            <span className="modal-abbr">{term.abbr}</span>
            <span className="modal-name">{term.name}</span>
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <p className="modal-formula">{term.formula}</p>
        <p className="modal-desc">{term.desc}</p>
        <LeagueAvgSection term={term} />
      </div>
    </div>
  );
}
