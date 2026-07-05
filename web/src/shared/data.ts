// 정적 JSON "DB" 로더 + 검색 인덱스 (디바이스 무관 공통 로직).
import { useEffect, useState } from "react";
import type { LeagueAverages, Matchup, Meta, Player, PlayerIndexEntry, PlayerProfile, StrengthData } from "./types";
import { useYear } from "./year";

const BASE = import.meta.env.BASE_URL; // '/' 또는 '/U18-baseball-player/'

async function getJSON<T>(rel: string): Promise<T> {
  const res = await fetch(`${BASE}data/${rel}`);
  if (!res.ok) throw new Error(`데이터 로드 실패: ${rel} (${res.status})`);
  return (await res.json()) as T;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, error: null });
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch(
        (e) =>
          alive &&
          setState({ data: null, loading: false, error: String(e?.message ?? e) })
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

// 모든 로더는 선택된 연도(data/{year}/…) 기준으로 적재.
export const useMeta = () => {
  const { year } = useYear();
  return useAsync<Meta>(() => getJSON(`${year}/meta.json`), [year]);
};

// 특정 시합/대회의 meta (teamGames 등 — 규정 계산 스코프용). slug 비면 null.
export const useTournamentMeta = (slug: string | "") => {
  const { year } = useYear();
  return useAsync<Meta | null>(
    () =>
      slug
        ? getJSON<Meta>(`${year}/by-tournament/${encodeURIComponent(slug)}/meta.json`).catch(() => null)
        : Promise.resolve(null),
    [year, slug]
  );
};

// 유령 선수(이름이 빈/괄호만/등번호 누락) 행은 모든 화면에서 제외 (스크레이퍼 재집계 전 안전망).
const isRealPlayer = <T extends { name?: string; number?: string }>(p: T) =>
  !!p.name && p.name !== "()" && !!p.number;

export const usePlayerIndex = () => {
  const { year } = useYear();
  return useAsync<PlayerIndexEntry[]>(
    () => getJSON<PlayerIndexEntry[]>(`${year}/players/index.json`).then((rows) => rows.filter(isRealPlayer)),
    [year]
  );
};

export const usePlayer = (id: string | undefined) => {
  const { year } = useYear();
  return useAsync<Player>(
    () => (id ? getJSON(`${year}/players/${id}.json`) : Promise.reject(new Error("선수 없음"))),
    [id, year]
  );
};

// 선수별 상대전적 샤드(모바일 최적화): 해당 선수가 관여한 매치업만 로드.
export const usePlayerMatchups = (id: string | undefined) => {
  const { year } = useYear();
  return useAsync<Matchup[]>(
    () => (id ? getJSON<Matchup[]>(`${year}/matchups/${id}.json`).catch(() => []) : Promise.resolve([])),
    [id, year]
  );
};

// 기록 테이블/리더보드용: 사전 집계된 단일 파일을 로드(대규모 시즌 대비).
// gameLog 가 빠진 슬림 형태이며, 선수 상세는 usePlayer 로 개별 로드.
export const useAllPlayers = () => {
  const { year } = useYear();
  return useAsync<Player[]>(
    () => getJSON<Player[]>(`${year}/records/players.json`).then((rows) => rows.filter(isRealPlayer)),
    [year]
  );
};

// 시합/대회 목록 (없으면 빈 배열)
export interface TournamentEntry {
  slug: string;
  title: string;
  gameCount: number;
}
export const useTournaments = () => {
  const { year } = useYear();
  return useAsync<TournamentEntry[]>(
    () => getJSON<TournamentEntry[]>(`${year}/tournaments.json`).catch(() => []),
    [year]
  );
};

// 특정 시합의 records (slim Player[]). slug 비면 전체 시즌 records 로 폴백.
export const useTournamentRecords = (slug: string | "") => {
  const { year } = useYear();
  return useAsync<Player[]>(
    () =>
      slug
        ? getJSON<Player[]>(`${year}/by-tournament/${encodeURIComponent(slug)}/records.json`)
            .then((rows) => rows.filter(isRealPlayer))
            .catch(() => [])
        : getJSON<Player[]>(`${year}/records/players.json`).then((rows) => rows.filter(isRealPlayer)),
    [year, slug]
  );
};

// 특정 시합의 매치업 전체 (Matchup[]). slug 비면 빈 배열(시합 미지정 시 호출자는 시즌 매치업 사용).
export const useTournamentMatchups = (slug: string | "") => {
  const { year } = useYear();
  return useAsync<Matchup[]>(
    () =>
      slug
        ? getJSON<Matchup[]>(`${year}/by-tournament/${encodeURIComponent(slug)}/matchups.json`).catch(() => [])
        : Promise.resolve([]),
    [year, slug]
  );
};

// 선수 프로필(출신학교/수상내역 — KBSA player_view 수집본). personNo 없으면 null.
export const usePlayerProfile = (personNo: string | undefined) =>
  useAsync<PlayerProfile | null>(
    () =>
      personNo
        ? getJSON<PlayerProfile>(`profiles/${personNo}.json`).catch(() => null)
        : Promise.resolve(null),
    [personNo]
  );

// 리그 평균 (전체/시합별 — 데이터 갱신 시점마다 재계산). 없으면 null.
export const useLeagueAverages = () => {
  const { year } = useYear();
  return useAsync<LeagueAverages | null>(
    () => getJSON<LeagueAverages>(`${year}/averages.json`).catch(() => null),
    [year]
  );
};

// 상대 강도 지수 (가중치 랭킹용 — 데이터 갱신 시점마다 재계산). 없으면 null.
export const useStrength = () => {
  const { year } = useYear();
  return useAsync<StrengthData | null>(
    () => getJSON<StrengthData>(`${year}/strength.json`).catch(() => null),
    [year]
  );
};

// 이름 부분 일치 검색 (초성/대소문자 무시 정도의 단순 매칭).
export function searchPlayers(
  index: PlayerIndexEntry[],
  query: string
): PlayerIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return index.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
  );
}
