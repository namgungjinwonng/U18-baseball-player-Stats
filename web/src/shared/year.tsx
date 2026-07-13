// 시즌(연도) 선택 컨텍스트 — 누적 데이터를 연도별로 조회.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const BASE = import.meta.env.BASE_URL;
const SESSION_YEAR_KEY = "u18-selected-year";

interface YearState {
  year: number;
  years: number[];
  setYear: (y: number) => void;
}
const YearCtx = createContext<YearState>({ year: 0, years: [], setYear: () => {} });

export function YearProvider({ children }: { children: ReactNode }) {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYearState] = useState<number>(0);

  useEffect(() => {
    fetch(`${BASE}data/years.json`)
      .then((r) => r.json())
      .then((ys: number[]) => {
        setYears(ys);
        const currentYear = new Date().getFullYear();
        let savedYear = 0;
        try {
          savedYear = Number(sessionStorage.getItem(SESSION_YEAR_KEY));
        } catch {
          // 저장소가 차단된 환경에서는 현재 연도 기본값만 사용한다.
        }
        setYearState(
          ys.includes(savedYear) ? savedYear : ys.includes(currentYear) ? currentYear : ys[0]
        );
      })
      .catch(() => {
        setYears([2026]);
        setYearState(2026);
      });
  }, []);

  const setYear = (y: number) => {
    setYearState(y);
    try {
      sessionStorage.setItem(SESSION_YEAR_KEY, String(y));
    } catch {
      // 저장소가 차단돼도 현재 화면의 연도 전환은 계속 동작한다.
    }
  };

  if (!year) return null; // 연도 확정 전 렌더 보류
  return <YearCtx.Provider value={{ year, years, setYear }}>{children}</YearCtx.Provider>;
}

export const useYear = () => useContext(YearCtx);

// 연도 선택 드롭다운(데스크탑/모바일 공용).
export function YearSelect({ className = "" }: { className?: string }) {
  const { year, years, setYear } = useYear();
  return (
    <select
      className={`year-select ${className}`}
      value={year}
      onChange={(e) => setYear(Number(e.target.value))}
      aria-label="시즌 연도 선택"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y} 시즌
        </option>
      ))}
    </select>
  );
}
