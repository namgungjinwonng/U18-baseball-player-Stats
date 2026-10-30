// 현재 시즌 기록이 없는 매치업에서 현재 엔트리로 검증한 직전 연도 개인 기록 참고 분석을 표시한다.
import { useMemo } from "react";
import { useSchedule, useSchedules, useTeams, useYearRecords } from "./data";
import { AiAnalysisPanel, type AiOptionSupport } from "./ai/AiAnalysisPanel";
import { buildConditions } from "./ai/buildConditions";
import { upcomingGames } from "./ai/conditions";
import { OptionsError, filterRecords, scopeActive, scopePayload, type AiOptions } from "./ai/options";
import { buildPreviousSeasonAnalysis, type PreviousSeasonAnalysis } from "./previousSeasonAnalysis";
import type { Player, ScheduleGame, TeamRosterEntry } from "./types";

export function PreviousSeasonAnalysisContent({ year, result, options }: { year: number; result: PreviousSeasonAnalysis; options?: AiOptionSupport }) {
  if (!result.input) return <p className="state muted">{result.reason}</p>;
  return (
    <>
      <div className="versus-reference" role="note">
        <strong>{year - 1} 기록 참고 · {year} 현재 엔트리 기준</strong>
        <p>전년도 3학년·현재 명단에 없는 선수는 제외했습니다. 올해 팀 성적·등급·선발 예고가 아닙니다.</p>
        {result.input.reference!.teams.map((t) => <p key={t.team}>{t.team} · 현재 {t.rosterCount}명 중 전년도 기록 확인 {t.matchedCount}명 · 미포함 {t.rosterCount - t.matchedCount}명</p>)}
      </div>
      <AiAnalysisPanel input={result.input} ruleLines={result.lines} getExtra={() => result.extra} options={options} />
    </>
  );
}

// 시즌 초 참고 분석의 「분석 옵션」 — 학년 제외는 참고하는 전년도 기록의 학년 기준(예: 2027 시즌 초 「3학년 제외」 = 2026 3학년 제외).
// 전년도 3학년(졸업)·현재 엔트리에 없는 선수(전학 간 선수 포함)는 옵션과 상관없이 항상 빠진다.
export function referenceOptions(args: {
  year: number; a: string; b: string; roster: TeamRosterEntry[]; previous: Player[]; result: PreviousSeasonAnalysis;
  prevGames: ScheduleGame[]; currentGames: ScheduleGame[];
}): AiOptionSupport | undefined {
  const { year, a, b, roster, previous, result } = args;
  if (!result.input) return undefined;
  const base = result.input;
  const run = (o: AiOptions) => buildPreviousSeasonAnalysis(year, a, b, roster, filterRecords(previous, null, { ...o, excludeMovedOut: false }));
  const counts = (r: PreviousSeasonAnalysis) => new Map((r.input?.reference?.teams ?? []).map((t) => [t.team, t.matchedCount]));
  const sampleOf = (o: AiOptions) => {
    const before = counts(result), after = counts(run(o));
    return base.reference!.teams.map((t) => ({ team: t.team, text: `전년도 기록 확인 ${before.get(t.team) ?? 0}명 → ${after.get(t.team) ?? 0}명` }));
  };
  const conditionArgs = {
    splitGames: args.prevGames, splitYear: year - 1, targetGames: args.currentGames,
    aName: base.aName, bName: base.bName, basis: `${year - 1} 시즌(전년도)`,
  };
  return {
    upcoming: upcomingGames(args.currentGames, a, b),
    gradeNote: `학년은 ${year - 1} 기록 기준입니다. 전년도 3학년(졸업)과 전학 간 선수는 항상 제외됩니다.`,
    sample: (o) => (o.excludeGrades.length ? sampleOf(o) : null),
    build: async (o, signal) => {
      const r = o.excludeGrades.length ? run(o) : result;
      if (!r.input) throw new OptionsError(r.reason ?? "선택한 학년을 빼면 참고할 전년도 기록이 없습니다.");
      const extra = { ...r.extra };
      if (scopeActive(o)) extra.scope = scopePayload(o, sampleOf(o), year - 1, true);
      if (o.conditions) {
        extra.conditions = await buildConditions(o, conditionArgs, signal);
      }
      return { input: r.input, extra };
    },
    prefetch: (o) => { if (o.conditions) buildConditions(o, conditionArgs).catch(() => {}); },
  };
}

export function PreviousSeasonAnalysisView({ year, a, b }: { year: number; a: string; b: string }) {
  const roster = useTeams();
  const previous = useYearRecords(year - 1);
  const schedule = useSchedule();
  const prevSchedule = useSchedules([year - 1]);
  const ready = roster.scope === String(year) && previous.scope === String(year - 1);
  const result = useMemo(() => ready && roster.data && previous.data
    ? buildPreviousSeasonAnalysis(year, a, b, roster.data, previous.data) : null,
  [ready, roster.data, previous.data, year, a, b]);
  const options = useMemo(() => result && roster.data && previous.data
    ? referenceOptions({
        year, a, b, roster: roster.data, previous: previous.data, result,
        prevGames: prevSchedule.data ?? [], currentGames: schedule.data?.year === year ? schedule.data.games : [],
      }) : undefined,
  [result, roster.data, previous.data, prevSchedule.data, schedule.data, year, a, b]);
  if (roster.loading || previous.loading) return <p className="state">현재 엔트리와 {year - 1} 개인 기록을 확인하는 중…</p>;
  if (!ready || !result) return <p className="state muted">현재 엔트리 또는 {year - 1} 개인 기록을 확인할 수 없어 참고 분석을 제공하지 않습니다. 명단을 추정해서 채우지 않습니다.</p>;
  return <PreviousSeasonAnalysisContent year={year} result={result} options={options} />;
}
