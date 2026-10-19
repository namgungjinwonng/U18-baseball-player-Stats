// 상대전적 화면의 선택 상태(역할·기준 선수·학교·상대·대회)를 URL 쿼리와 동기화하는 훅 (데스크탑·모바일 공용).
// 예: /matchup?role=batter&p=<선수ID>&pn=<personNo>&school=<학교>&o=<상대ID>&t=<대회slug>
import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { Role } from "./matchup";
import type { PlayerIndexEntry } from "./types";

export function useMatchupQuery(index: PlayerIndexEntry[] | null) {
  const [params, setParams] = useSearchParams();
  const aRole: Role = params.get("role") === "pitcher" ? "pitcher" : "batter";
  const pid = params.get("p") ?? "";
  const pn = params.get("pn") ?? "";
  const school = params.get("school") ?? "";
  const oppId = params.get("o") ?? "";
  const tournamentSlug = params.get("t") ?? "";

  // 한 이벤트 안의 여러 setter 호출을 한 번의 URL 교체로 모은다
  // (setSearchParams 를 연달아 부르면 마지막 호출만 남는다).
  const pending = useRef<URLSearchParams | null>(null);
  const patch = (key: string, value: string) => {
    if (!pending.current) {
      pending.current = new URLSearchParams(window.location.search);
      queueMicrotask(() => {
        const next = pending.current!;
        pending.current = null;
        setParams(next, { replace: true });
      });
    }
    if (value) pending.current.set(key, value);
    else pending.current.delete(key);
  };

  // 선수 ID는 시즌마다 바뀌므로 personNo(pn)로도 다시 찾는다.
  const a = useMemo(() => {
    if (!index || !pid) return null;
    return index.find((p) => p.id === pid) ?? (pn ? index.find((p) => p.personNo === pn) : undefined) ?? null;
  }, [index, pid, pn]);
  useEffect(() => {
    if (!a) return;
    if (a.id !== pid) patch("p", a.id);
    // 선수 상세 바로가기처럼 p만 받은 경우에도 연도 전환 때 다시 연결되도록 pn을 채운다.
    if (a.personNo && a.personNo !== pn) patch("pn", a.personNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, pid, pn]);

  return {
    aRole,
    a,
    school,
    oppId,
    tournamentSlug,
    setARole: (role: Role) => patch("role", role === "pitcher" ? "pitcher" : ""),
    setA: (p: PlayerIndexEntry | null) => {
      patch("p", p?.id ?? "");
      patch("pn", p?.personNo ?? "");
    },
    setSchool: (team: string) => patch("school", team),
    setOppId: (id: string) => patch("o", id),
    setTournamentSlug: (slug: string) => patch("t", slug),
  };
}
