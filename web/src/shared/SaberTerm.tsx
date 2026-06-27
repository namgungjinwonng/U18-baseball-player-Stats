// 세이버메트릭스 용어 라벨(클릭 시 설명 모달). 데스크탑/모바일 공용.
import { useEffect, useState, type ReactNode } from "react";
import { TERM_MAP } from "./Glossary";

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
        {children ?? abbr}
      </button>
      {open && <TermModal term={term} onClose={() => setOpen(false)} />}
    </>
  );
}

function TermModal({
  term,
  onClose,
}: {
  term: { abbr: string; name: string; formula: string; desc: string };
  onClose: () => void;
}) {
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
      </div>
    </div>
  );
}
