// 정적 JSON "DB" 로더 + 검색 인덱스 (디바이스 무관 공통 로직).
import { useEffect, useState, useSyncExternalStore } from "react";
import type {
  LeagueAverages, Matchup, Meta, Player, PlayerIndexEntry, PlayerProfile,
  ScheduleData, StrengthData, TeamRosterEntry,
} from "./types";
import { useYear } from "./year";

const BASE = import.meta.env.BASE_URL; // '/' 또는 '/U18-baseball-player/'

// 새 문서 로드마다 고유한 URL로 시작해 GitHub Pages의 10분 HTTP 캐시를 우회한다.
// 이후 메타 변경 감지 시 lastUpdated 기반 리비전으로 교체되어 모든 훅이 재조회된다.
let dataRevision = `start-${Date.now()}`;
const revisionListeners = new Set<() => void>();

export function setDataRevision(revision: string) {
  if (revision === dataRevision) return;
  dataRevision = revision;
  revisionListeners.forEach((listener) => listener());
}

function useDataRevision() {
  return useSyncExternalStore(
    (listener) => {
      revisionListeners.add(listener);
      return () => revisionListeners.delete(listener);
    },
    () => dataRevision
  );
}

const jsonCache = new Map<string, Promise<unknown>>();

async function getJSON<T>(rel: string): Promise<T> {
  const join = rel.includes("?") ? "&" : "?";
  const url = `${BASE}data/${rel}${join}v=${encodeURIComponent(dataRevision)}`;
  let pending = jsonCache.get(url);
  if (!pending) {
    pending = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Data load failed: ${rel} (${response.status})`);
      return response.json();
    });
    jsonCache.set(url, pending);
    pending.catch(() => jsonCache.delete(url));
  }
  return pending as Promise<T>;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const revision = useDataRevision();
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    // 자동 갱신 중에는 기존 화면을 유지하고, 최초 로드일 때만 loading 상태를 표시한다.
    setState((prev) => ({ ...prev, loading: prev.data === null, error: null }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch(
        (e) =>
          alive &&
          setState((prev) => ({
            data: prev.data,
            loading: false,
            error: prev.data === null ? String(e?.message ?? e) : null,
          }))
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);
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
    () => id ? getJSON<Player>(`${year}/players/${id}.json`) : Promise.reject(new Error("선수 없음")),
    [id, year]
  );
};

export type CareerYears = Record<string, string>;
export const useCareerPlayers = (careerYears: CareerYears | undefined) =>
  useAsync<{ year: number; player: Player }[]>(
    async () => {
      if (!careerYears) return [];
      const seasons = Object.entries(careerYears)
        .map(([year, id]) => ({ year: Number(year), id }))
        .sort((a, b) => a.year - b.year);
      return Promise.all(
        seasons.map(async ({ year, id }) => ({
          year,
          player: await getJSON<Player>(`${year}/players/${id}.json`),
        }))
      );
    },
    [careerYears]
  );

// 통산 비교용 연도별 리그 평균. 일부 연도 파일이 없어도 해당 연도만 null로 둔다.
export const useCareerAverages = (years: number[]) => {
  const yearKey = [...new Set(years)].sort((a, b) => a - b).join(",");
  return useAsync<Record<number, LeagueAverages | null>>(
    async () => Object.fromEntries(
      await Promise.all(
        (yearKey ? yearKey.split(",").map(Number) : []).map(async (year) => [
          year,
          await getJSON<LeagueAverages>(`${year}/averages.json`).catch(() => null),
        ] as const)
      )
    ),
    [yearKey]
  );
};

// 선수별 상대전적 샤드(모바일 최적화): 해당 선수가 관여한 매치업만 로드.
export const usePlayerMatchups = (id: string | undefined) => {
  const { year } = useYear();
  return useAsync<Matchup[]>(
    () => id
      ? getJSON<Player>(`${year}/players/${id}.json`).then((player) => player.matchups ?? [])
      : Promise.resolve([]),
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

// 경기 일정 (scraper/src/schedule.ts 수집 — 경기일정 페이지용). 없으면 null.
export const useSchedule = () => {
  const { year } = useYear();
  return useAsync<ScheduleData | null>(
    () => getJSON<ScheduleData>(`${year}/schedule.json`).catch(() => null),
    [year]
  );
};

// 팀·선수현황 (scraper/src/teams.ts 수집 — 선수현황 페이지용). 없으면 null.
export const useTeams = () => {
  const { year } = useYear();
  return useAsync<TeamRosterEntry[] | null>(
    () => getJSON<TeamRosterEntry[]>(`${year}/teams.json`).catch(() => null),
    [year]
  );
};

// 이름/팀 부분 일치 + 등번호(백넘버) 검색.
// 공백으로 나눈 토큰을 전부 만족(AND) — 예: "충암 45" = 충암고 45번.
// 숫자만인 토큰은 등번호 정확 일치로만 매칭 (부분 일치 시 4 → 14·40·45 등 노이즈 방지).
export function searchPlayers(
  index: PlayerIndexEntry[],
  query: string
): PlayerIndexEntry[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return index.filter((p) =>
    tokens.every((t) =>
      /^\d+$/.test(t)
        ? p.number === t
        : p.name.toLowerCase().includes(t) || p.team.toLowerCase().includes(t)
    )
  );
}
