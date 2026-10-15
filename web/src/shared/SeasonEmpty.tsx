// 새 시즌 데이터(경기 기록·선수현황·일정)가 아직 없을 때의 안내와 지난 시즌 이동 버튼.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../design/ui";
import { seasonHasRecords } from "./data";
import { useYear } from "./year";

type EmptyKind = "records" | "teams" | "schedule";

const MESSAGE: Record<EmptyKind, (year: number) => string> = {
  records: (year) => `${year} 시즌 경기 기록이 아직 없습니다`,
  teams: (year) => `KBSA에 ${year} 시즌 선수 등록 전입니다`,
  schedule: (year) => `KBSA에 ${year} 시즌 경기 일정이 아직 없습니다`,
};

export function SeasonEmpty({ kind }: { kind: EmptyKind }) {
  const { year, years, setYear } = useYear();
  // 선택 연도보다 앞선 시즌 중 가장 최근 시즌 (years.json 은 내림차순).
  const previous = years.find((y) => y < year);
  return (
    <div className="state season-empty">
      <p className="season-empty__title">{MESSAGE[kind](year)}</p>
      <p className="caption-sm">
        {kind === "records"
          ? "첫 경기 결과가 수집되면 자동으로 채워집니다."
          : "KBSA에 등록되면 자동으로 채워집니다."}
      </p>
      <div className="season-empty__actions">
        {previous != null && (
          <Button sm onClick={() => setYear(previous)}>
            {previous} 시즌 보기
          </Button>
        )}
        {kind === "records" && (
          <Link to="/schedule">
            <Button variant="secondary" sm>경기일정</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// 선택 시즌에 경기 기록(meta.json)이 있는지. 최초 확인 전에만 null.
// 연도 전환 중에는 직전 판정을 유지해 기록 화면을 다시 마운트(필터 초기화)하지 않는다.
export function useSeasonHasRecords(): boolean | null {
  const { year } = useYear();
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    seasonHasRecords(year).then((next) => alive && setHas(next));
    return () => {
      alive = false;
    };
  }, [year]);
  return has;
}

// 기록 기반 화면(홈·기록·랭킹·상대전적·검색·선수 상세) 공통 가드.
// 새 시즌에 기록이 없으면 지난 시즌 데이터가 남아 보이지 않도록 안내로 대신한다.
export function SeasonRecordsGate({ wrapClass, children }: { wrapClass: string; children: ReactNode }) {
  const has = useSeasonHasRecords();
  if (has === null) return null;
  if (!has) {
    return (
      <div className={wrapClass}>
        <SeasonEmpty kind="records" />
      </div>
    );
  }
  return <>{children}</>;
}
