// 현재 시즌 기록이 없는 매치업에서 현재 엔트리로 검증한 직전 연도 개인 기록 참고 분석을 표시한다.
import { useMemo } from "react";
import { useTeams, useYearRecords } from "./data";
import { AiAnalysisPanel } from "./ai/AiAnalysisPanel";
import { buildPreviousSeasonAnalysis, type PreviousSeasonAnalysis } from "./previousSeasonAnalysis";

export function PreviousSeasonAnalysisContent({ year, result }: { year: number; result: PreviousSeasonAnalysis }) {
  if (!result.input) return <p className="state muted">{result.reason}</p>;
  return (
    <>
      <div className="versus-reference" role="note">
        <strong>{year - 1} 기록 참고 · {year} 현재 엔트리 기준</strong>
        <p>전년도 3학년·현재 명단에 없는 선수는 제외했습니다. 올해 팀 성적·등급·선발 예고가 아닙니다.</p>
        {result.input.reference!.teams.map((t) => <p key={t.team}>{t.team} · 현재 {t.rosterCount}명 중 전년도 기록 확인 {t.matchedCount}명 · 미포함 {t.rosterCount - t.matchedCount}명</p>)}
      </div>
      <AiAnalysisPanel input={result.input} ruleLines={result.lines} getExtra={() => result.extra} />
    </>
  );
}

export function PreviousSeasonAnalysisView({ year, a, b }: { year: number; a: string; b: string }) {
  const roster = useTeams();
  const previous = useYearRecords(year - 1);
  const ready = roster.scope === String(year) && previous.scope === String(year - 1);
  const result = useMemo(() => ready && roster.data && previous.data
    ? buildPreviousSeasonAnalysis(year, a, b, roster.data, previous.data) : null,
  [ready, roster.data, previous.data, year, a, b]);
  if (roster.loading || previous.loading) return <p className="state">현재 엔트리와 {year - 1} 개인 기록을 확인하는 중…</p>;
  if (!ready || !result) return <p className="state muted">현재 엔트리 또는 {year - 1} 개인 기록을 확인할 수 없어 참고 분석을 제공하지 않습니다. 명단을 추정해서 채우지 않습니다.</p>;
  return <PreviousSeasonAnalysisContent year={year} result={result} />;
}
