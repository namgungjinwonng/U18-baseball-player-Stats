// 모바일 카드 목록을 정해진 개수씩 가로 스와이프 페이지로 표시하는 공용 그리드.
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

export function PagedCardGrid({ children, perPage, compact, layout = "cards", hint = "← 옆으로 넘겨 다음 학교" }: {
  children: ReactNode;
  perPage: number;
  compact?: boolean;
  layout?: "cards" | "single";
  hint?: string;
}) {
  const cards = Children.toArray(children);
  const pages = Array.from({ length: Math.ceil(cards.length / perPage) }, (_, i) =>
    cards.slice(i * perPage, (i + 1) * perPage)
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [cards.length, perPage]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.max(0, Math.min(Math.round(el.scrollLeft / el.clientWidth), pages.length - 1)));
  };

  return (
    <div className={`${layout === "cards" ? "sch-team-grid " : ""}paged-grid${compact ? " paged-grid--compact" : ""}${layout === "single" ? " paged-grid--single" : ""}`}>
      {pages.length > 1 && (
        <p className="caption-sm paged-grid__hint" aria-live="polite">
          {hint} · {active + 1}/{pages.length}
        </p>
      )}
      <div className="paged-grid__track" ref={trackRef} onScroll={onScroll}>
        {pages.map((page, i) => (
          <div className="paged-grid__page" key={i}>{page}</div>
        ))}
      </div>
    </div>
  );
}
